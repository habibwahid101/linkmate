resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

locals {
  canonical_url = var.domain_name != "" ? "https://${var.domain_name}" : ""
  database_url = format(
    "postgresql://%s:%s@%s:%s/%s?sslmode=require",
    urlencode(aws_db_instance.this.username),
    urlencode(random_password.db.result),
    aws_db_instance.this.address,
    aws_db_instance.this.port,
    aws_db_instance.this.db_name,
  )
}

# Composite secret kept for ops/export; App Runner uses per-key secrets below
# because runtime_environment_secrets requires a full Secrets Manager ARN
# (JSON key suffixes are not supported by App Runner).
resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}/app"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL       = local.database_url
    BETTER_AUTH_SECRET = random_password.auth_secret.result
    APP_URL            = local.canonical_url
    BETTER_AUTH_URL    = local.canonical_url
    SES_FROM_EMAIL     = var.ses_from_email
  })
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.name_prefix}/database-url"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

resource "aws_secretsmanager_secret" "better_auth_secret" {
  name                    = "${var.name_prefix}/better-auth-secret"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "better_auth_secret" {
  secret_id     = aws_secretsmanager_secret.better_auth_secret.id
  secret_string = random_password.auth_secret.result
}

resource "aws_secretsmanager_secret" "app_url" {
  count                   = var.domain_name != "" ? 1 : 0
  name                    = "${var.name_prefix}/app-url"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app_url" {
  count         = var.domain_name != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.app_url[0].id
  secret_string = local.canonical_url
}

resource "aws_secretsmanager_secret" "better_auth_url" {
  count                   = var.domain_name != "" ? 1 : 0
  name                    = "${var.name_prefix}/better-auth-url"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "better_auth_url" {
  count         = var.domain_name != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.better_auth_url[0].id
  secret_string = local.canonical_url
}

resource "aws_secretsmanager_secret" "ses_from_email" {
  count                   = var.ses_from_email != "" ? 1 : 0
  name                    = "${var.name_prefix}/ses-from-email"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "ses_from_email" {
  count         = var.ses_from_email != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.ses_from_email[0].id
  secret_string = var.ses_from_email
}
