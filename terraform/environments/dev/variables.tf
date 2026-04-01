variable "environment" {
  type = string
}

variable "bucket_name" {
  type = string
}

variable "allowed_origins" {
  type = list(string)
}

variable "glacier_transition_days" {
  type = number
}

variable "log_bucket_name" {
  type = string
}
