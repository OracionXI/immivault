output "bucket_name" {
  value = module.s3_documents.bucket_name
}

output "bucket_arn" {
  value = module.s3_documents.bucket_arn
}

output "iam_access_key_id" {
  value     = module.iam_s3_user.access_key_id
  sensitive = true
}

output "iam_secret_access_key" {
  value     = module.iam_s3_user.secret_access_key
  sensitive = true
}
