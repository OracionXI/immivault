provider "aws" {
  region = "us-east-1"
}

module "s3_documents" {
  source                  = "../../modules/s3-documents"
  bucket_name             = var.bucket_name
  environment             = var.environment
  allowed_origins         = var.allowed_origins
  glacier_transition_days = var.glacier_transition_days
  log_bucket_name         = var.log_bucket_name
}

module "iam_s3_user" {
  source      = "../../modules/iam-s3-user"
  username    = "ordena-s3-documents-${var.environment}"
  bucket_arn  = module.s3_documents.bucket_arn
  environment = var.environment
}
