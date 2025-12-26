resource "aws_s3_bucket" "vault_bucket" {
  bucket = var.bucket_name 

  force_destroy = false 

  tags = {
    Name        = "SecureVault Storage" 
    Environment = "Production"
  }
}

resource "aws_s3_bucket_versioning" "vault_versioning" {
  bucket = aws_s3_bucket.vault_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vault_encryption" {
  bucket = aws_s3_bucket.vault_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "vault_public_block" {
  bucket = aws_s3_bucket.vault_bucket.id 

  block_public_acls = true 
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}