output "aws_account_id_masked" {
  value = "****${substr(data.aws_caller_identity.current.account_id, length(data.aws_caller_identity.current.account_id) - 4, 4)}"
}

output "aws_region" {
  value = var.aws_region
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "rds_identifier" {
  value = aws_db_instance.this.id
}

output "rds_engine" {
  value = "${aws_db_instance.this.engine} ${aws_db_instance.this.engine_version_actual}"
}

output "rds_publicly_accessible" {
  value = aws_db_instance.this.publicly_accessible
}

output "rds_backup_retention_days" {
  value = aws_db_instance.this.backup_retention_period
}

output "rds_endpoint_host" {
  value     = aws_db_instance.this.address
  sensitive = true
}

output "app_runner_service_arn" {
  value = try(aws_apprunner_service.this[0].arn, null)
}

output "app_runner_service_url" {
  value = try(aws_apprunner_service.this[0].service_url, null)
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "secrets_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "app_runner_secret_arns" {
  description = "Per-key Secrets Manager ARNs referenced by App Runner runtime_environment_secrets."
  value = {
    DATABASE_URL       = aws_secretsmanager_secret.database_url.arn
    BETTER_AUTH_SECRET = aws_secretsmanager_secret.better_auth_secret.arn
    APP_URL            = aws_secretsmanager_secret.app_url.arn
    BETTER_AUTH_URL    = aws_secretsmanager_secret.better_auth_url.arn
    SES_FROM_EMAIL     = try(aws_secretsmanager_secret.ses_from_email[0].arn, null)
  }
}

output "acm_certificate_arn" {
  value = try(aws_acm_certificate.domain[0].arn, null)
}

output "acm_dns_validation" {
  description = "Create these DNS records if Route 53 is not used."
  value = var.domain_name == "" ? [] : [
    for dvo in aws_acm_certificate.domain[0].domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ]
}

output "ses_from_email" {
  value = var.ses_from_email
}

output "ses_status" {
  value = var.ses_from_email == "" ? "NOT_CONFIGURED" : "SANDBOX_OR_PENDING_VERIFICATION"
}
