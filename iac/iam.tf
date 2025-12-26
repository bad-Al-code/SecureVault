resource "aws_iam_user" "vault_user" {
  name = var.iam_user_name
  path = "/system/"
}

resource "aws_iam_access_key" "vault_user_key" {
  user = aws_iam_user.vault_user.name
}

resource "aws_iam_policy" "vault_s3_policy" {
  name        = "SecureVaultS3Access-${var.bucket_name}"
  description = "Allows access only to the SecureVault S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.vault_bucket.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = "${aws_s3_bucket.vault_bucket.arn}/*"
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "vault_attach" {
  user       = aws_iam_user.vault_user.name
  policy_arn = aws_iam_policy.vault_s3_policy.arn
}