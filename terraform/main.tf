# Terraform Main Configuration for CampusConnect Multi-Region Database Setup

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21.0"
    }
  }
}

# Primary AWS Region Provider (us-east-1)
provider "aws" {
  alias  = "primary"
  region = var.primary_region
}

# Secondary AWS Region Provider (eu-west-1)
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

# Network VPC Peering for Cross-Region Logical Replication
resource "aws_vpc_peering_connection" "cross_region_peering" {
  provider    = aws.primary
  peer_region = var.secondary_region
  vpc_id      = var.primary_vpc_id
  peer_vpc_id = var.secondary_vpc_id

  tags = {
    Name        = "campusconnect-db-cross-region-peering"
    Environment = var.environment
  }
}
