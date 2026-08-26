variable "aws_region" {
  type        = string
  description = "AWS region for the isolated Link Mate stack."
  default     = "ap-south-1"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for resource names. Must be unique in the account."
  default     = "linkmate-prod"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "db_instance_class" {
  type        = string
  description = "Smallest reasonable production RDS class for ap-south-1."
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 50
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_engine_version" {
  type    = string
  default = "16.15"
}

variable "domain_name" {
  type        = string
  description = "Canonical production hostname, e.g. example.com. Empty skips ACM/custom domain."
  default     = ""
}

variable "route53_zone_id" {
  type        = string
  description = "If the domain is in Route 53, ACM DNS validation is automatic."
  default     = ""
}

variable "ses_from_email" {
  type        = string
  description = "From address for verification/reset mail. Empty skips SES identity."
  default     = ""
}

variable "budget_email" {
  type        = string
  description = "Email for the monthly cost alarm. Empty skips the budget."
  default     = ""
}

variable "monthly_budget_usd" {
  type    = number
  default = 40
}

variable "enable_app_runner" {
  type        = bool
  description = "Create the App Runner service. Set true only after the first ECR image exists."
  default     = false
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "github_org" {
  type    = string
  default = "habibwahid101"
}

variable "github_repo" {
  type    = string
  default = "linkmate"
}

variable "github_owner_id" {
  type        = string
  description = "Numeric GitHub owner ID used in immutable OIDC subject claims."
  default     = "260748622"
}

variable "github_repository_id" {
  type        = string
  description = "Numeric GitHub repository ID used in immutable OIDC subject claims."
  default     = "1347172093"
}

variable "create_github_oidc_provider" {
  type        = bool
  description = "Create the GitHub OIDC provider if this account does not already have one."
  default     = true
}

variable "app_cpu" {
  type    = string
  default = "0.25 vCPU"
}

variable "app_memory" {
  type    = string
  default = "0.5 GB"
}

variable "app_min_instances" {
  type    = number
  default = 1
}

variable "app_max_instances" {
  type    = number
  default = 3
}
