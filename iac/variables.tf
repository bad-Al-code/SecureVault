variable "aws_region" {
  description = "The AWS region to deploy resources into."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "The globally unique name of the SecureVault S3 bucket"
  type        = string
}

variable "iam_user_name" {
  description = "The name of the IAM user for CLI access"
  type        = string
  default     = "secure-vault-cli-user"
}