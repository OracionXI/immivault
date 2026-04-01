# ── IAM User (no console access) ─────────────────────────────────────────────
resource "aws_iam_user" "s3_service" {
  name = var.username
  path = "/ordena/service-accounts/"

  tags = {
    Environment = var.environment
    Purpose     = "Ordena S3 document operations"
  }
}

# ── Access Key ────────────────────────────────────────────────────────────────
resource "aws_iam_access_key" "s3_service" {
  user = aws_iam_user.s3_service.name
}

# ── Least-privilege Policy ────────────────────────────────────────────────────
resource "aws_iam_policy" "s3_documents" {
  name        = "ordena-s3-documents-${var.environment}"
  description = "Least-privilege S3 access for Ordena document service (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "OrgPrefixOperations"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.bucket_arn}/orgs/*"
      },
      {
        Sid    = "DenyUnencryptedUploads"
        Effect = "Deny"
        Action = "s3:PutObject"
        Resource = "${var.bucket_arn}/orgs/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "s3_documents" {
  user       = aws_iam_user.s3_service.name
  policy_arn = aws_iam_policy.s3_documents.arn
}
