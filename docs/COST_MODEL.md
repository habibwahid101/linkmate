# Link Mate AWS cost model (ap-south-1)

Cost-first production. No NAT Gateway, no ALB, no CloudFront, no EKS, no Multi-AZ RDS.

## MINIMUM MONTHLY ESTIMATE

**USD 16–22**

| Item | Why | Approx |
|---|---|---|
| RDS PostgreSQL `db.t4g.micro` single-AZ, 20 GB gp3 | Durable ledger | $12–15 |
| App Runner 0.25 vCPU / 0.5 GB, min 1 | HTTPS app | $5–8 |
| ECR (≤10 images) | Deploy artifact | < $1 |
| Secrets Manager (1 secret) | DB + auth secret | $0.40 |
| VPC interface endpoint (SES) | Email without NAT | $7 if billed hourly; may be the largest non-compute line |
| CloudWatch logs 14-day retention | Bounded | < $1 |
| Budget | Free | $0 |

If the SES VPC endpoint is unused before email is enabled, it can stay; NAT Gateway (~$32) is still more expensive.

## NORMAL EARLY-STAGE ESTIMATE

**USD 22–35** (light traffic, SES sandbox, no custom domain yet)

Drivers: App Runner request-hours, RDS storage growth, VPC endpoint hours.

## MAIN COST DRIVERS

1. App Runner instance hours (min size 1)
2. RDS instance class
3. VPC endpoint hours (SES PrivateLink)
4. Data transfer (should be tiny)

## UPGRADE TRIGGERS (do not buy early)

| Trigger | Next step |
|---|---|
| CPU / memory saturation on App Runner | 0.5 vCPU / 1 GB |
| RDS storage > 80% after autoscaling headroom | raise max allocated storage |
| Single-AZ outage is unacceptable | Multi-AZ RDS (~2× instance) |
| Email volume + public APIs need general internet from VPC | NAT Gateway (avoid until then) |
| Global static performance | CloudFront later |

## Explicitly not provisioned

NAT Gateway, ALB, CloudFront, EKS/ECS cluster, Multi-AZ, Performance Insights, enhanced RDS monitoring, Elastic IPs.

## Payment module cost

Manual bKash / Nagad / Bank / Cash uses existing RDS tables (`payment_requests`, `payment_method_settings`).
No extra AWS service, no object storage, no payment gateway fees.
Screenshot upload remains deferred (no S3 required).
