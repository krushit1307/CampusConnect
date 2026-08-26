# CampusConnect Architecture: Multi-Region Active-Active Database Layer & Failover Strategy

This document describes the high-availability (HA) database architecture, logical replication setup, connection pooling/routing, failover procedures, and split-brain conflict resolution strategy for CampusConnect.

---

## 1. High-Level Architecture Overview

To eliminate single-region dependency and guarantee high availability, CampusConnect implements a **Multi-Region Active-Active PostgreSQL Deployment**:

- **Primary Region (`us-east-1`)**: Main database cluster handling primary traffic and logical replication streams.
- **Secondary Region (`eu-west-1`)**: Active secondary database cluster handling local read/write traffic with cross-region logical synchronization.
- **Connection Pooler (`pgBouncer` / `Supavisor`)**: Deployed in front of PostgreSQL instances in each region to manage client connections, pool resources, and route transactions smoothly.
- **Global Traffic Routing (AWS Route 53 / Cloudflare)**: Directs application traffic to the nearest health-checked region using latency-based routing with failover rules.

```
                  +-----------------------------------+
                  |   Global DNS / Load Balancer     |
                  +-----------------+-----------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  Region 1: us-east-1  |                       |  Region 2: eu-west-1  |
|                       |                       |                       |
|  +-----------------+  |                       |  +-----------------+  |
|  |   pgBouncer     |  |                       |  |   pgBouncer     |  |
|  +--------+--------+  |                       |  +--------+--------+  |
|           |           |                       |           |           |
|           v           |                       |           v           |
|  +-----------------+  |  Logical Replication  |  +-----------------+  |
|  | PostgreSQL DB 1 | <=========================> | PostgreSQL DB 2 |  |
|  +-----------------+  |  (Publication/Sub)    |  +-----------------+  |
+-----------------------+                       +-----------------------+
```

---

## 2. Logical Replication Publications & Subscriptions

PostgreSQL native logical replication (`pgoutput`) is used to sync data asynchronously across regions.

### 2.1 Server Configuration Requirements

In `postgresql.conf` on both nodes:

```ini
wal_level = logical
max_replication_slots = 10
max_worker_processes = 10
max_wal_senders = 10
```

### 2.2 Publication Setup (Primary / Region 1)

```sql
-- Create publication for all application tables
CREATE PUBLICATION campusconnect_pub FOR ALL TABLES;
```

### 2.3 Subscription Setup (Secondary / Region 2)

```sql
-- Create subscription on Secondary node pointing to Primary node
CREATE SUBSCRIPTION campusconnect_sub
  CONNECTION 'host=db1.us-east-1.campusconnect.internal port=5432 dbname=campusconnect user=replicator password=SECRET'
  PUBLICATION campusconnect_pub
  WITH (copy_data = true, create_slot = true, enabled = true);
```

For bi-directional active-active replication, reciprocal publications and subscriptions are created (`campusconnect_pub_r2` and `campusconnect_sub_r1`) with `origin = NONE` to avoid infinite loop duplication of updates.

---

## 3. Connection Pooling & Routing (pgBouncer / Supavisor)

`pgBouncer` or `Supavisor` is configured in front of each database instance to prevent connection exhaustion and handle seamless failover routing.

### 3.1 pgBouncer Configuration (`pgbouncer.ini`)

```ini
[databases]
campusconnect = host=127.0.0.1 port=5432 dbname=campusconnect pool_size=50

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

### 3.2 Read/Write Connection Routing

- **Writes**: Routed to local pgBouncer -> local PostgreSQL instance. In the event of primary outage, health check monitors update connection string targets to point to the surviving region database.
- **Reads**: Local pgBouncer instances serve read traffic directly from the nearest regional PostgreSQL replica.

---

## 4. Failover Procedure & Runbook

### 4.1 Automated Health Probe Monitoring

Health monitoring probes query `SELECT 1` and test PostgreSQL replication lag:

```sql
SELECT slot_name, plugin, active, wal_status
FROM pg_replication_slots
WHERE slot_name = 'campusconnect_sub';
```

### 4.2 Failover Trigger Criteria

Failover is initiated automatically or manually when:

1. Primary region database is unreachable for > 30 seconds.
2. Network partition isolates Primary AWS/GCP region.

### 4.3 Failover Execution Steps

1. **Reroute Traffic**: Update DNS / Global Load Balancer health checks to mark `us-east-1` degraded and route 100% of client traffic to `eu-west-1`.
2. **Promote / Enable Writes on Secondary**:
   - Verify secondary connection pooler (`pgBouncer`) is accepting transaction write traffic.
3. **Replication Sync Check**: Monitor replication queues and apply any remaining WAL logs.
4. **Post-Failover Verification**: Execute application synthetic health checks (`/api/health`).

---

## 5. Conflict Resolution Strategy for Split-Brain Scenarios

When operating Active-Active databases across multiple regions, network partitions can cause split-brain scenarios where concurrent updates occur on both nodes.

### 5.1 ID Generation: UUID v4 / Snowflakes

To prevent primary key collisions across regions:

- Primary key IDs use **UUID v4** (`gen_random_uuid()`) instead of auto-incrementing integer sequences (`SERIAL`).
- For legacy integer tables, odd IDs are assigned to Region 1 (`INCREMENT BY 2 START WITH 1`) and even IDs to Region 2 (`INCREMENT BY 2 START WITH 2`).

### 5.2 Conflict Resolution Policies

#### A. Last-Write-Wins (LWW) with Immutable Microsecond Timestamps

- Every mutable table includes an `updated_at` timestamp column generated with microsecond precision (`TIMESTAMPTZ` with UTC timezone).
- In conflict scenarios, logical replication triggers enforce Last-Write-Wins based on `updated_at`.

#### B. Conflict Logging Table

Conflicts are automatically recorded to a dedicated audit log table for developer visibility:

```sql
CREATE TABLE IF NOT EXISTS replication_conflict_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(128) NOT NULL,
    record_id UUID NOT NULL,
    region_source VARCHAR(64) NOT NULL,
    conflict_type VARCHAR(64) NOT NULL, -- INSERT_EXISTS, UPDATE_STALE, DELETE_MISSING
    local_data JSONB,
    remote_data JSONB,
    resolved_at TIMESTAMPTZ DEFAULT clock_timestamp()
);
```

#### C. Conflict Resolution Triggers

Custom conflict resolution trigger function for resolution:

```sql
CREATE OR REPLACE FUNCTION resolve_replication_conflict()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.updated_at < OLD.updated_at) THEN
        -- Keep existing local record (LWW rule)
        INSERT INTO replication_conflict_logs (table_name, record_id, region_source, conflict_type, local_data, remote_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'REMOTE', 'UPDATE_STALE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NULL; -- Suppress stale remote update
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
