locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.name_prefix}-vpc" }
}

resource "aws_subnet" "private" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = false
  tags                    = { Name = "${var.name_prefix}-private-${count.index + 1}" }
}

# No NAT Gateway: App Runner reaches the internet on its public path.
# The VPC connector only needs private routes to RDS in this VPC.

resource "aws_security_group" "apprunner" {
  name        = "${var.name_prefix}-apprunner"
  description = "App Runner VPC connector — egress to RDS only"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name_prefix}-apprunner" }
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds"
  description = "Link Mate RDS — PostgreSQL from App Runner only"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name_prefix}-rds" }
}

resource "aws_vpc_security_group_egress_rule" "apprunner_to_rds" {
  security_group_id            = aws_security_group.apprunner.id
  referenced_security_group_id = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres to Link Mate RDS"
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_apprunner" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.apprunner.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres from App Runner connector"
}

# SES API over PrivateLink — only when SES from-email is configured.
# Avoids Interface endpoint hourly cost when mail is not yet enabled.
resource "aws_security_group" "vpce" {
  count       = var.ses_from_email != "" ? 1 : 0
  name        = "${var.name_prefix}-vpce"
  description = "Interface VPC endpoints (SES)"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name_prefix}-vpce" }
}

resource "aws_vpc_security_group_ingress_rule" "vpce_https" {
  count                        = var.ses_from_email != "" ? 1 : 0
  security_group_id            = aws_security_group.vpce[0].id
  referenced_security_group_id = aws_security_group.apprunner.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  description                  = "HTTPS from App Runner"
}

resource "aws_vpc_security_group_egress_rule" "apprunner_https_vpce" {
  count                        = var.ses_from_email != "" ? 1 : 0
  security_group_id            = aws_security_group.apprunner.id
  referenced_security_group_id = aws_security_group.vpce[0].id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  description                  = "HTTPS to VPC endpoints"
}

resource "aws_vpc_endpoint" "ses" {
  count               = var.ses_from_email != "" ? 1 : 0
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.email"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpce[0].id]
  private_dns_enabled = true
}

resource "aws_apprunner_vpc_connector" "this" {
  vpc_connector_name = "${var.name_prefix}-connector"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner.id]
}
