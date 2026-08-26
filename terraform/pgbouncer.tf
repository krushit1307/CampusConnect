# pgBouncer / Supavisor Connection Pooler Infrastructure Configuration

# Security Group for Primary pgBouncer Instance
resource "aws_security_group" "primary_pgbouncer_sg" {
  provider    = aws.primary
  name        = "campusconnect-pgbouncer-sg-primary"
  description = "Security group for primary pgBouncer connection pooler"
  vpc_id      = var.primary_vpc_id

  ingress {
    from_port   = 6432
    to_port     = 6432
    protocol    = "tcp"
    cidr_blocks = [var.primary_vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Primary pgBouncer Launch Template / EC2
resource "aws_instance" "primary_pgbouncer" {
  provider               = aws.primary
  ami                    = var.pgbouncer_ami_id
  instance_type          = "t3.small"
  vpc_security_group_ids = [aws_security_group.primary_pgbouncer_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              apt-get update && apt-get install -y pgbouncer
              cat << 'PGCONF' > /etc/pgbouncer/pgbouncer.ini
              [databases]
              campusconnect = host=${aws_db_instance.primary_db.address} port=5432 dbname=${var.db_name} pool_size=50

              [pgbouncer]
              listen_addr = 0.0.0.0
              listen_port = 6432
              auth_type = md5
              auth_file = /etc/pgbouncer/userlist.txt
              pool_mode = transaction
              max_client_conn = 1000
              default_pool_size = 25
              PGCONF
              systemctl restart pgbouncer
              EOF

  tags = {
    Name        = "campusconnect-pgbouncer-primary"
    Environment = var.environment
  }
}

# Secondary pgBouncer Launch Template / EC2
resource "aws_instance" "secondary_pgbouncer" {
  provider               = aws.secondary
  ami                    = var.pgbouncer_ami_id
  instance_type          = "t3.small"

  user_data = <<-EOF
              #!/bin/bash
              apt-get update && apt-get install -y pgbouncer
              cat << 'PGCONF' > /etc/pgbouncer/pgbouncer.ini
              [databases]
              campusconnect = host=${aws_db_instance.secondary_db.address} port=5432 dbname=${var.db_name} pool_size=50

              [pgbouncer]
              listen_addr = 0.0.0.0
              listen_port = 6432
              auth_type = md5
              auth_file = /etc/pgbouncer/userlist.txt
              pool_mode = transaction
              max_client_conn = 1000
              default_pool_size = 25
              PGCONF
              systemctl restart pgbouncer
              EOF

  tags = {
    Name        = "campusconnect-pgbouncer-secondary"
    Environment = var.environment
  }
}
