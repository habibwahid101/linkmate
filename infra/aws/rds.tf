resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.name_prefix}-db" }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name_prefix}-pg16"
  family = "postgres16"
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name_prefix}-pg"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = "linkmate"
  username = "linkmate"
  password = random_password.db.result

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false
  availability_zone      = local.azs[0]

  backup_retention_period   = var.db_backup_retention_days
  backup_window             = "19:00-20:00"
  maintenance_window        = "sun:20:00-sun:21:00"
  copy_tags_to_snapshot     = true
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-final"

  auto_minor_version_upgrade   = true
  performance_insights_enabled = false
  monitoring_interval          = 0
  parameter_group_name         = aws_db_parameter_group.this.name

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  apply_immediately = false
}
