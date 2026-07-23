variable "primary_region" {
  type        = string
  default     = "us-east-1"
  description = "Primary AWS deployment region"
}

variable "secondary_region" {
  type        = string
  default     = "eu-west-1"
  description = "Secondary AWS failover region"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Target environment name"
}

variable "db_name" {
  type        = string
  default     = "campusconnect"
  description = "PostgreSQL database name"
}

variable "db_username" {
  type        = string
  default     = "campusconnect_admin"
  description = "PostgreSQL master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "PostgreSQL master password"
  default     = "ChangeMeInProduction123!"
}

variable "db_instance_class" {
  type        = string
  default     = "db.r6g.large"
  description = "RDS Database instance class"
}

variable "db_allocated_storage" {
  type        = number
  default     = 100
  description = "Allocated storage in GB"
}

variable "primary_vpc_id" {
  type        = string
  default     = "vpc-0123456789primary"
  description = "VPC ID for Primary Region"
}

variable "secondary_vpc_id" {
  type        = string
  default     = "vpc-0987654321secondary"
  description = "VPC ID for Secondary Region"
}

variable "primary_vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for Primary VPC"
}

variable "pgbouncer_ami_id" {
  type        = string
  default     = "ami-0c7217cdde317cfec"
  description = "AMI ID for pgBouncer pooler EC2 instance"
}
