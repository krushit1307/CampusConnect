output "primary_db_endpoint" {
  value       = aws_db_instance.primary_db.endpoint
  description = "Primary PostgreSQL RDS database connection endpoint"
}

output "secondary_db_endpoint" {
  value       = aws_db_instance.secondary_db.endpoint
  description = "Secondary PostgreSQL RDS database connection endpoint"
}

output "primary_pgbouncer_ip" {
  value       = aws_instance.primary_pgbouncer.private_ip
  description = "Private IP of Primary pgBouncer pooler"
}

output "secondary_pgbouncer_ip" {
  value       = aws_instance.secondary_pgbouncer.private_ip
  description = "Private IP of Secondary pgBouncer pooler"
}

output "cross_region_peering_id" {
  value       = aws_vpc_peering_connection.cross_region_peering.id
  description = "VPC Peering connection ID between regions"
}
