# Primary & Secondary PostgreSQL Multi-Region Database Provisioning & Replication Setup

# Primary DB Parameter Group enabling Logical Replication
resource "aws_db_parameter_group" "primary_pg_params" {
  provider = aws.primary
  name     = "campusconnect-pg-params-primary"
  family   = "postgres15"

  parameter {
    name  = "wal_level"
    value = "logical"
  }

  parameter {
    name  = "max_replication_slots"
    value = "10"
  }

  parameter {
    name  = "max_worker_processes"
    value = "10"
  }

  tags = {
    Environment = var.environment
  }
}

# Secondary DB Parameter Group enabling Logical Replication
resource "aws_db_parameter_group" "secondary_pg_params" {
  provider = aws.secondary
  name     = "campusconnect-pg-params-secondary"
  family   = "postgres15"

  parameter {
    name  = "wal_level"
    value = "logical"
  }

  parameter {
    name  = "max_replication_slots"
    value = "10"
  }

  parameter {
    name  = "max_worker_processes"
    value = "10"
  }

  tags = {
    Environment = var.environment
  }
}

# Primary PostgreSQL RDS Instance (Region 1)
resource "aws_db_instance" "primary_db" {
  provider               = aws.primary
  identifier             = "campusconnect-db-primary"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  parameter_group_name   = aws_db_parameter_group.primary_pg_params.name
  skip_final_snapshot    = true
  multi_az               = true
  publicly_accessible    = false

  tags = {
    Name        = "campusconnect-primary-db"
    Region      = var.primary_region
    Environment = var.environment
  }
}

# Secondary PostgreSQL RDS Instance (Region 2)
resource "aws_db_instance" "secondary_db" {
  provider               = aws.secondary
  identifier             = "campusconnect-db-secondary"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  parameter_group_name   = aws_db_parameter_group.secondary_pg_params.name
  skip_final_snapshot    = true
  multi_az               = true
  publicly_accessible    = false

  tags = {
    Name        = "campusconnect-secondary-db"
    Region      = var.secondary_region
    Environment = var.environment
  }
}
