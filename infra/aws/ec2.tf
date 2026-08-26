# Public subnet + IGW only - no NAT. EC2 reaches ECR/SSM over the public
# internet and RDS over the private VPC path.
resource "aws_internet_gateway" "this" {
  count  = var.enable_ec2 ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-igw" }
}

resource "aws_subnet" "public" {
  count                   = var.enable_ec2 ? 1 : 0
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, 2)
  availability_zone       = local.azs[0]
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.name_prefix}-public-1" }
}

resource "aws_route_table" "public" {
  count  = var.enable_ec2 ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-public" }
}

resource "aws_route" "public_internet" {
  count                  = var.enable_ec2 ? 1 : 0
  route_table_id         = aws_route_table.public[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this[0].id
}

resource "aws_route_table_association" "public" {
  count          = var.enable_ec2 ? 1 : 0
  subnet_id      = aws_subnet.public[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_security_group" "ec2" {
  count       = var.enable_ec2 ? 1 : 0
  name        = "${var.name_prefix}-ec2"
  description = "Link Mate EC2 - public 80/443, private Postgres to RDS"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name_prefix}-ec2" }
}

resource "aws_vpc_security_group_ingress_rule" "ec2_http" {
  count             = var.enable_ec2 ? 1 : 0
  security_group_id = aws_security_group.ec2[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "HTTP until custom domain + TLS"
}

resource "aws_vpc_security_group_ingress_rule" "ec2_https" {
  count             = var.enable_ec2 ? 1 : 0
  security_group_id = aws_security_group.ec2[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  description       = "HTTPS reserved for domain cutover"
}

resource "aws_vpc_security_group_egress_rule" "ec2_https_out" {
  count             = var.enable_ec2 ? 1 : 0
  security_group_id = aws_security_group.ec2[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  description       = "ECR, SSM, yum"
}

resource "aws_vpc_security_group_egress_rule" "ec2_http_out" {
  count             = var.enable_ec2 ? 1 : 0
  security_group_id = aws_security_group.ec2[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "HTTP package mirrors"
}

resource "aws_vpc_security_group_egress_rule" "ec2_to_rds" {
  count                        = var.enable_ec2 ? 1 : 0
  security_group_id            = aws_security_group.ec2[0].id
  referenced_security_group_id = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres to Link Mate RDS"
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ec2" {
  count                        = var.enable_ec2 ? 1 : 0
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ec2[0].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres from Link Mate EC2"
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  count              = var.enable_ec2 ? 1 : 0
  name               = "${var.name_prefix}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  count      = var.enable_ec2 ? 1 : 0
  role       = aws_iam_role.ec2[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "ec2_inline" {
  count = var.enable_ec2 ? 1 : 0
  statement {
    sid = "EcrPull"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchCheckLayerAvailability",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
    ]
    resources = ["*"]
  }
  statement {
    sid     = "ReadAppSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = compact([
      aws_secretsmanager_secret.app.arn,
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.better_auth_secret.arn,
      var.domain_name != "" ? aws_secretsmanager_secret.app_url[0].arn : null,
      var.domain_name != "" ? aws_secretsmanager_secret.better_auth_url[0].arn : null,
      var.ses_from_email != "" ? aws_secretsmanager_secret.ses_from_email[0].arn : null,
    ])
  }
}

resource "aws_iam_role_policy" "ec2" {
  count  = var.enable_ec2 ? 1 : 0
  name   = "${var.name_prefix}-ec2"
  role   = aws_iam_role.ec2[0].id
  policy = data.aws_iam_policy_document.ec2_inline[0].json
}

resource "aws_iam_instance_profile" "ec2" {
  count = var.enable_ec2 ? 1 : 0
  name  = "${var.name_prefix}-ec2"
  role  = aws_iam_role.ec2[0].name
}

data "aws_ami" "al2023" {
  count       = var.enable_ec2 ? 1 : 0
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_instance" "app" {
  count                       = var.enable_ec2 ? 1 : 0
  ami                         = data.aws_ami.al2023[0].id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2[0].id]
  iam_instance_profile        = aws_iam_instance_profile.ec2[0].name
  associate_public_ip_address = true
  monitoring                  = false

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.ec2_root_volume_gb
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  user_data = templatefile("${path.module}/ec2-userdata.sh", {
    aws_region   = var.aws_region
    name_prefix  = var.name_prefix
    image_repo   = aws_ecr_repository.this.repository_url
    image_tag    = var.image_tag
    secret_db    = aws_secretsmanager_secret.database_url.name
    secret_auth  = aws_secretsmanager_secret.better_auth_secret.name
    secret_app   = var.domain_name != "" ? aws_secretsmanager_secret.app_url[0].name : ""
    secret_authu = var.domain_name != "" ? aws_secretsmanager_secret.better_auth_url[0].name : ""
    secret_ses   = var.ses_from_email != "" ? aws_secretsmanager_secret.ses_from_email[0].name : ""
  })

  tags = {
    Name    = var.name_prefix
    Role    = "app"
    Project = "LinkMate"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}
