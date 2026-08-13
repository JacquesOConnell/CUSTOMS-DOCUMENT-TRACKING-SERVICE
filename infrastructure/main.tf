data "aws_caller_identity" "current" {}

locals {
  prefix = "${var.project_name}-${var.environment}"
  suffix = substr(data.aws_caller_identity.current.account_id, -6, 6)
}

resource "aws_s3_bucket" "documents" {
  bucket = "${local.prefix}-documents-${local.suffix}"
}
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = [var.allowed_origin]
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    id     = "expire-incomplete-uploads"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

resource "aws_s3_bucket" "portal" {
  bucket = "${local.prefix}-portal-${local.suffix}"
}
resource "aws_s3_bucket_public_access_block" "portal" {
  bucket                  = aws_s3_bucket.portal.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "jobs" {
  name         = "${local.prefix}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "job_id"
  attribute {
    name = "job_id"
    type = "S"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
}
resource "aws_dynamodb_table" "customers" {
  name         = "${local.prefix}-customers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "customer_id"
  attribute {
    name = "customer_id"
    type = "S"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
}
resource "aws_dynamodb_table" "audit" {
  name         = "${local.prefix}-audit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"
  attribute {
    name = "event_id"
    type = "S"
  }
  server_side_encryption { enabled = true }
}

data "archive_file" "api" {
  type        = "zip"
  source_file = "${path.module}/../backend/api.py"
  output_path = "${path.module}/api.zip"
}
resource "aws_iam_role" "lambda" {
  name = "${local.prefix}-lambda"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "lambda" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Scan"], Resource = [aws_dynamodb_table.jobs.arn, aws_dynamodb_table.customers.arn, aws_dynamodb_table.audit.arn] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject"], Resource = "${aws_s3_bucket.documents.arn}/*" }
    ]
  })
}
resource "aws_lambda_function" "api" {
  function_name    = "${local.prefix}-api"
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.12"
  handler          = "api.handler"
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256
  timeout          = 15
  memory_size      = 256
  environment {
    variables = {
      JOBS_TABLE       = aws_dynamodb_table.jobs.name
      CUSTOMERS_TABLE  = aws_dynamodb_table.customers.name
      AUDIT_TABLE      = aws_dynamodb_table.audit.name
      DOCUMENTS_BUCKET = aws_s3_bucket.documents.id
      ALLOWED_ORIGIN   = var.allowed_origin
    }
  }
}
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.prefix}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = [var.allowed_origin]
    allow_methods = ["GET", "POST", "PATCH", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 300
  }
}
resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "routes" {
  for_each  = toset(["GET /jobs", "POST /jobs", "PATCH /jobs/{id}", "GET /health"])
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}
resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_cloudfront_origin_access_control" "portal" {
  name                              = "${local.prefix}-portal"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
resource "aws_cloudfront_distribution" "portal" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  origin {
    domain_name              = aws_s3_bucket.portal.bucket_regional_domain_name
    origin_id                = "portal"
    origin_access_control_id = aws_cloudfront_origin_access_control.portal.id
  }
  default_cache_behavior {
    target_origin_id       = "portal"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
    min_ttl     = 0
    default_ttl = 300
    max_ttl     = 3600
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
}
data "aws_iam_policy_document" "portal" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.portal.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.portal.arn]
    }
  }
}
resource "aws_s3_bucket_policy" "portal" {
  bucket = aws_s3_bucket.portal.id
  policy = data.aws_iam_policy_document.portal.json
}
resource "aws_s3_object" "portal_files" {
  for_each     = fileset("${path.module}/../portal", "**/*")
  bucket       = aws_s3_bucket.portal.id
  key          = each.value
  source       = "${path.module}/../portal/${each.value}"
  etag         = filemd5("${path.module}/../portal/${each.value}")
  content_type = lookup({ html = "text/html", css = "text/css", js = "application/javascript", png = "image/png" }, reverse(split(".", each.value))[0], "application/octet-stream")
}
resource "aws_s3_object" "config" {
  bucket       = aws_s3_bucket.portal.id
  key          = "config.js"
  content      = "window.APP_CONFIG={apiUrl:'${aws_apigatewayv2_api.api.api_endpoint}'};"
  content_type = "application/javascript"
}

output "portal_url" { value = "https://${aws_cloudfront_distribution.portal.domain_name}" }
output "api_url" { value = aws_apigatewayv2_api.api.api_endpoint }
output "documents_bucket" { value = aws_s3_bucket.documents.id }
