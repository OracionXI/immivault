variable "bucket_name" {
  description = "Name of the S3 documents bucket"
  type        = string
}

variable "environment" {
  description = "Deployment environment: dev or prod"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be 'dev' or 'prod'."
  }
}

variable "allowed_origins" {
  description = "CORS allowed origins for browser PUT uploads"
  type        = list(string)
}

variable "glacier_transition_days" {
  description = "Days before objects transition to Glacier storage class"
  type        = number
}

variable "log_bucket_name" {
  description = "Name of the S3 access logs bucket"
  type        = string
}
