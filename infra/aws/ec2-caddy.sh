#!/bin/bash
set -euo pipefail
# Install Caddy on AL2023 and enable TLS for linkmateglobal.com.
# Safe to re-run. Does not recreate EC2/RDS.
if ! command -v caddy >/dev/null 2>&1; then
  dnf install -y 'dnf-command(copr)' || true
  if ! rpm -q caddy >/dev/null 2>&1; then
    curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/setup.rpm.sh" | bash
    dnf install -y caddy
  fi
fi
install -d -m 0755 /opt/linkmate /etc/caddy
curl -fsSL -o /etc/caddy/Caddyfile https://raw.githubusercontent.com/habibwahid101/linkmate/main/infra/aws/Caddyfile
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy
systemctl is-active caddy
