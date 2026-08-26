# Link Mate AWS deployment runbook

Do not run this until the owner has reviewed Terraform and authorized deploy.
Do not connect the custom domain in this pass.
Do not enable payments.

Region: `ap-south-1`. Source: GitHub `main`.

## 1. Authenticate AWS

```bash
aws sts get-caller-identity
export AWS_REGION=ap-south-1
```

Use a role limited to this account. Do not reuse unrelated project credentials.

## 2. Terraform plan

```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# set budget_email and ses_from_email if known; leave domain_name empty
terraform init
terraform plan -out=tfplan
```

Owner reviews the plan. Expected first apply: VPC, RDS, ECR, secrets, IAM, GitHub OIDC, SES identity if email set. App Runner is **off** until an image exists (`enable_app_runner=false`).

## 3. Owner review

Confirm:

- no unrelated VPCs/RDS modified
- RDS not public
- no NAT Gateway
- tags `Project=LinkMate` `Environment=Production`

## 4. Terraform apply (core)

```bash
terraform apply tfplan
terraform output github_deploy_role_arn
terraform output ecr_repository_url
```

Put `github_deploy_role_arn` in GitHub secret `AWS_ROLE_ARN`.
Set GitHub Actions variable `AWS_DEPLOY=true` only after the first image policy is understood.

## 5. Build image

```bash
docker build \
  --build-arg LINKMATE_BUILD_COMMIT=$(git rev-parse HEAD) \
  -t linkmate-prod:local .
```

## 6. Push ECR

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO="$ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com/linkmate-prod"
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com"
SHA=$(git rev-parse HEAD)
docker tag linkmate-prod:local "$REPO:$SHA"
docker tag linkmate-prod:local "$REPO:latest"
docker push "$REPO:$SHA"
docker push "$REPO:latest"
```

## 7. Deploy App Runner

```bash
# from infra/aws
terraform apply -var enable_app_runner=true -var image_tag=$SHA
```

Or let `.github/workflows/deploy-aws.yml` start a deployment after `AWS_DEPLOY=true`.

## 8. Migrations

The container entrypoint runs `scripts/migrate.mjs` before the server.
Confirm CloudWatch logs: `[migrate] applied` or `already applied`.
Do not run DROP/TRUNCATE.

## 9. Health

```bash
URL=$(terraform output -raw app_runner_service_url)
curl -sS "https://$URL/api/health"
# {"ok":true,"status":"live"}
```

## 10. Readiness

```bash
curl -sS "https://$URL/api/readiness"
# {"ok":true,"db":"connected","durable":true}
```

If `durable` is not true, **stop**. Do not continue.

## 11. First admin

Sign up once in the UI (ordinary member). Then from an operator machine:

```bash
DATABASE_URL='postgresql://…?sslmode=require' \
ADMIN_EMAIL='owner@example.com' \
node scripts/provision-admin.mjs
```

Never auto-promote the first public user.

## 12. SES

1. Verify `SES_FROM_EMAIL` in the SES console (sandbox: only verified recipients receive mail).
2. Request production access when ready.
3. Confirm forgot-password does **not** report success if SES is unset.

## 13. PITR restore test

Follow `docs/BACKUP_RECOVERY.md`. Restore to a **new** instance. Delete it after verification.

## 14. Domain — later, not now

After owner approval: ACM DNS, App Runner custom domain, update `APP_URL` and `BETTER_AUTH_URL`. See `docs/ENVIRONMENT.md`.

## 15. Domain QA — later

HTTPS, HTTP→HTTPS, www→apex, login/signup/session, `/api/readiness`, no mixed content.
