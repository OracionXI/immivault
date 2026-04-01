output "access_key_id" {
  description = "AWS access key ID for the S3 service account"
  value       = aws_iam_access_key.s3_service.id
  sensitive   = true
}

output "secret_access_key" {
  description = "AWS secret access key for the S3 service account"
  value       = aws_iam_access_key.s3_service.secret
  sensitive   = true
}

output "username" {
  description = "IAM username"
  value       = aws_iam_user.s3_service.name
}
