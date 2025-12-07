provider "aws" {
    region = "us-west-2"
}

resource "aws_s3_bucket" "example" {
  bucket = "demo-terraform-eks-bucket"

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }

  lifecycle {
    prevent_destroy = false
  }

}

resource  "aws_dynamodb_table" "basic-dynamodb-table" {
    name = "terraform-eks-state-locks"
    billing_mode = "PAY_PER_REQUEST"
    hash_key = "LockID"

    attribute {
        name = "UserId"
        type = "S"
    }

}