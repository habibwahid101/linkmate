locals {
  app_env = {
    APP_ENV               = "production"
    NODE_ENV              = "production"
    PORT                  = "8080"
    HOST                  = "0.0.0.0"
    PAYMENTS_MODE         = "disabled"
    ENABLE_DEMO_NETWORK   = "false"
    ENABLE_SAMPLE_DATA    = "false"
    ENABLE_SIMULATE_JOINS = "false"
    ALLOW_BOOTSTRAP_ADMIN = "false"
    AUTH_BROKER           = "off"
    AWS_REGION            = var.aws_region
  }
}

resource "aws_apprunner_service" "this" {
  count        = var.enable_app_runner ? 1 : 0
  service_name = var.name_prefix

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.this.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"
      image_configuration {
        port                          = "8080"
        runtime_environment_variables = local.app_env
        runtime_environment_secrets = {
          DATABASE_URL       = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"
          BETTER_AUTH_SECRET = "${aws_secretsmanager_secret.app.arn}:BETTER_AUTH_SECRET::"
          APP_URL            = "${aws_secretsmanager_secret.app.arn}:APP_URL::"
          BETTER_AUTH_URL    = "${aws_secretsmanager_secret.app.arn}:BETTER_AUTH_URL::"
          SES_FROM_EMAIL     = "${aws_secretsmanager_secret.app.arn}:SES_FROM_EMAIL::"
        }
      }
    }
    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = var.app_cpu
    memory            = var.app_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.this.arn
    }
    ingress_configuration {
      is_publicly_accessible = true
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  observability_configuration {
    observability_enabled = true
  }
}

resource "aws_cloudwatch_log_group" "apprunner" {
  name              = "/aws/apprunner/${var.name_prefix}/application"
  retention_in_days = 30
}
