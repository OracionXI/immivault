variable "username" {
  description = "IAM username for the S3 service account"
  type        = string
}

variable "bucket_arn" {
  description = "ARN of the S3 documents bucket"
  type        = string
}

variable "environment" {
  description = "Deployment environment: dev or prod"
  type        = string
}
