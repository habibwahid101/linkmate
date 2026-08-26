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
