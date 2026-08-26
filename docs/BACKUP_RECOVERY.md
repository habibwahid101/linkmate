# RDS backup and restore

Production database: private Amazon RDS PostgreSQL 16 in `ap-south-1`.

Configured by Terraform (`infra/aws/rds.tf`):

- automated backups
- retention **7 days**
- point-in-time recovery (RDS default when backups are on)
- storage encrypted
- deletion protection on
- final snapshot on delete
- **never restore over the production instance**

## Daily operations

RDS takes automated snapshots in the backup window `19:00–20:00 UTC`.
No extra snapshot product is required.

## Restore test (temporary instance)

Do this after first deploy, and after any risky migration.

```bash
REGION=ap-south-1
SRC=linkmate-prod-pg
NEW=linkmate-prod-pitr-test
TIME=$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)   # GNU date; use an ISO time inside the backup window

aws rds restore-db-instance-to-point-in-time \
  --region "$REGION" \
  --source-db-instance-identifier "$SRC" \
  --target-db-instance-identifier "$NEW" \
  --restore-time "$TIME" \
  --db-instance-class db.t4g.micro \
  --no-publicly-accessible \
  --db-subnet-group-name linkmate-prod-db \
  --vpc-security-group-ids <rds-sg-id>

aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$NEW"
```

Verify on the **temporary** instance only:

```bash
psql "$RESTORE_URL" -c "select count(*) from _migrations;"
psql "$RESTORE_URL" -c "select count(*) from membership_ids;"
psql "$RESTORE_URL" -c "select count(*) from commission_entries;"
psql "$RESTORE_URL" -c "select count(*) from wallet_transactions;"
psql "$RESTORE_URL" -c "select count(*) from \"user\";"
```

Then delete the test instance (production deletion protection stays on):

```bash
aws rds delete-db-instance \
  --region "$REGION" \
  --db-instance-identifier "$NEW" \
  --skip-final-snapshot
```

## Manual export (operator laptop, not public)

```bash
DATABASE_URL='postgresql://…?sslmode=require' node scripts/db-export.mjs > linkmate-export.json
```

Restore that JSON only into an isolated database with `scripts/db-restore.mjs`.
