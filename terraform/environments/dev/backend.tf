terraform {
  backend "s3" {
    bucket         = "ordena-terraform-state"
    key            = "environments/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ordena-terraform-locks"
    encrypt        = true
  }
}
