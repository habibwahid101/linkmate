resource "aws_ses_email_identity" "from" {
  count = var.ses_from_email != "" ? 1 : 0
  email = var.ses_from_email
}

resource "aws_acm_certificate" "domain" {
  count                     = var.domain_name != "" ? 1 : 0
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm" {
  for_each = var.domain_name != "" && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.domain[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}
  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "domain" {
  count                   = var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0
  certificate_arn         = aws_acm_certificate.domain[0].arn
  validation_record_fqdns = [for r in aws_route53_record.acm : r.fqdn]
}
