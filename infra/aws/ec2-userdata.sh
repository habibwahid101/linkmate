#!/bin/bash
set -euxo pipefail
export AWS_REGION="${aws_region}"
export LM_PREFIX="${name_prefix}"
export LM_REPO="${image_repo}"
export LM_TAG="${image_tag}"

dnf update -y
dnf install -y docker
systemctl enable --now docker

install -d -m 0755 /opt/linkmate
cat >/opt/linkmate/env.sh <<EOF
export AWS_REGION="$AWS_REGION"
export LM_PREFIX="$LM_PREFIX"
export LM_REPO="$LM_REPO"
export LM_TAG="$LM_TAG"
EOF

cat >/opt/linkmate/deploy.sh <<'DEPLOY'
#!/bin/bash
set -euo pipefail
# shellcheck disable=SC1091
. /opt/linkmate/env.sh
TOKEN=$(curl -sS -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
PUBLIC_IP=$(curl -sS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || true)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text --region "$AWS_REGION")
REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker pull "$LM_REPO:$LM_TAG"
get_secret() {
  aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$1" --query SecretString --output text
}
DATABASE_URL=$(get_secret "$LM_PREFIX/database-url")
BETTER_AUTH_SECRET=$(get_secret "$LM_PREFIX/better-auth-secret")
PUBLIC_ORIGIN="http://$PUBLIC_IP"
SES_FROM=""
if aws secretsmanager describe-secret --region "$AWS_REGION" --secret-id "$LM_PREFIX/ses-from-email" >/dev/null 2>&1; then
  SES_FROM=$(get_secret "$LM_PREFIX/ses-from-email")
fi
docker rm -f linkmate || true
docker run -d --name linkmate --restart unless-stopped \
  -p 80:8080 \
  -e NODE_ENV=production \
  -e APP_ENV=production \
  -e HOST=0.0.0.0 \
  -e PORT=8080 \
  -e PAYMENTS_MODE=disabled \
  -e MANUAL_PAYMENTS_ENABLED=true \
  -e ENABLE_DEMO_NETWORK=false \
  -e ENABLE_SAMPLE_DATA=false \
  -e ENABLE_SIMULATE_JOINS=false \
  -e ALLOW_BOOTSTRAP_ADMIN=false \
  -e AUTH_BROKER=off \
  -e AWS_REGION="$AWS_REGION" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  -e APP_URL="$PUBLIC_ORIGIN" \
  -e BETTER_AUTH_URL="$PUBLIC_ORIGIN" \
  -e SES_FROM_EMAIL="$SES_FROM" \
  "$LM_REPO:$LM_TAG"
DEPLOY
chmod 0755 /opt/linkmate/deploy.sh
/opt/linkmate/deploy.sh

cat >/etc/systemd/system/linkmate.service <<'UNIT'
[Unit]
Description=Link Mate container
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start linkmate
ExecStartPost=/bin/bash -c '/usr/bin/docker inspect -f "{{.State.Running}}" linkmate | grep -q true || /opt/linkmate/deploy.sh'
ExecStop=/usr/bin/docker stop linkmate
TimeoutStartSec=180

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable linkmate.service
