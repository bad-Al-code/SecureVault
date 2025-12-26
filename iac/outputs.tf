output "bucket_name" {
  description = "The name of the created S3 bucket"
  value       = aws_s3_bucket.vault_bucket.id
}

output "region" {
  description = "The AWS region"
  value       = var.aws_region
}

output "access_key_id" {
  description = "The Access Key ID for the Vault CLI User"
  value       = aws_iam_access_key.vault_user_key.id
}

output "secret_access_key" {
  description = "The Secret Access Key for the Vault CLI User"
  value       = aws_iam_access_key.vault_user_key.secret
  sensitive   = true
}