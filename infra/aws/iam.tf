data "aws_iam_policy_document" "apprunner_ecr" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_ecr" {
  name               = "${var.name_prefix}-apprunner-ecr"
  assume_role_policy = data.aws_iam_policy_document.apprunner_ecr.json
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

data "aws_iam_policy_document" "apprunner_instance" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_instance" {
  name               = "${var.name_prefix}-apprunner-instance"
  assume_role_policy = data.aws_iam_policy_document.apprunner_instance.json
}

data "aws_iam_policy_document" "apprunner_instance_inline" {
  statement {
    sid     = "ReadAppSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = compact([
      aws_secretsmanager_secret.app.arn,
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.better_auth_secret.arn,
      aws_secretsmanager_secret.app_url.arn,
      aws_secretsmanager_secret.better_auth_url.arn,
      var.ses_from_email != "" ? aws_secretsmanager_secret.ses_from_email[0].arn : null,
    ])
  }
  statement {
    sid       = "SendEmail"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "apprunner_instance" {
  name   = "${var.name_prefix}-instance"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.apprunner_instance_inline.json
}

# GitHub Actions OIDC — push to ECR and deploy EC2 without long-lived keys.
data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}@${var.github_owner_id}/${var.github_repo}@${var.github_repository_id}:*",
      ]
    }
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_github_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  github_oidc_provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
    ]
    resources = ["*"]
  }
  statement {
    sid = "AppRunnerCleanup"
    actions = [
      "apprunner:DescribeService",
      "apprunner:ListServices",
      "apprunner:DeleteService",
      "apprunner:ListOperations",
    ]
    resources = ["*"]
  }
  statement {
    sid = "Ec2Deploy"
    actions = [
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceStatus",
      "ec2:DescribeImages",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeRouteTables",
      "ec2:CreateTags",
      "ec2:RunInstances",
      "ec2:TerminateInstances",
      "iam:PassRole",
    ]
    resources = ["*"]
  }
  statement {
    sid = "SsmDeploy"
    actions = [
      "ssm:SendCommand",
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:DescribeInstanceInformation",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.name_prefix}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
