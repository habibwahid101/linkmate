# Link Mate AWS production

Isolated stack in **ap-south-1**. Grok is the build workspace only. GitHub is source of truth. This folder is the production infrastructure.

## Architecture

```
Internet → App Runner (public HTTPS)
              ↓ VPC connector (no NAT Gateway)
         private subnets
              ├─ RDS PostgreSQL 16 (encrypted, not public, 7-day backup/PITR)
              └─ SES VPC endpoint (email verification / password reset)
```

Tags on every resource: `Project=LinkMate`, `Environment=Production`, `ManagedBy=LinkMateIaC`.

Estimated launch cost (ap-south-1, single-AZ): **~$18–30 / month**
- RDS db.t4g.micro + 20 GB gp3
- App Runner 0.25 vCPU / 0.5 GB, min 1
- ECR + Secrets Manager + VPC endpoints
- No NAT Gateway, no ALB, no EKS, no CloudFront

## Apply (requires AWS credentials)

```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# edit domain / SES / budget email if known
terraform init
terraform plan
terraform apply
```

First apply creates VPC, RDS, ECR, secrets, IAM, GitHub OIDC role. It does **not** create App Runner until an image exists.

Then:

1. Put the `github_deploy_role_arn` output in the GitHub Actions secret `AWS_ROLE_ARN`.
2. Push `main` — CI builds the Node server image, pushes ECR, deploys App Runner.
3. Set `enable_app_runner=true` and `terraform apply` (or let the workflow create the service).
4. After signup, promote admin: `DATABASE_URL=… ADMIN_EMAIL=you@domain node scripts/provision-admin.mjs` from a trusted operator environment (never public).

## Restore test (never over production)

```bash
aws rds create-db-instance-read-replica ...   # or restore-db-instance-to-point-in-time
# verify schema, then delete the temporary instance
```

## Owner actions this workspace cannot perform

1. Provide AWS credentials or an IAM role this environment can assume.
2. Confirm billing is enabled.
3. DNS records if the domain is not in Route 53 (ACM validation CNAME — printed by terraform).
4. SES production access (leave sandbox until AWS approves).
5. GitHub secret `AWS_ROLE_ARN`.
6. First admin via `provision-admin.mjs` after the first real signup.
