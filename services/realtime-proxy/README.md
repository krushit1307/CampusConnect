# Realtime HTTP/2 SSE Multiplexing Proxy

High-performance, memory-efficient Rust proxy server built using **Tokio**, **Hyper**, and **Axum**.

It multiplexes thousands of client Server-Sent Events (SSE) connections into a single backend PostgreSQL `NOTIFY` subscription, supporting up to **100,000 concurrent live feed viewers** while preserving minimal memory footprint.

## Features

- **Postgres NOTIFY Listener**: Multiplexes database events into a single connection pool using `tokio-postgres`.
- **Zero-Copy Broadcast Engine**: Uses `tokio::sync::broadcast` and `Arc<str>` to stream notifications without per-client memory allocations.
- **HTTP/2 & SSE**: Supports multiplexed HTTP/2 streaming with keep-alive heartbeat pings every 15s to keep connections open through load balancers and proxies.
- **Health & Metrics Endpoints**: Exposes real-time active subscriber metrics (`/stats`) and container health checks (`/health`).
- **Resilient Reconnection**: Automatic reconnection with exponential backoff on PostgreSQL database disconnects.

## Architecture

```
[ PostgreSQL ]
      │ (NOTIFY live_feed_channel)
      ▼
[ Tokio Listener ]
      │ (Arc<str> Payload)
      ▼
[ Broadcast Channel ]
      │ (Zero-copy memory sharing)
 ┌────┼───────────────┬───────────────┐
 ▼    ▼               ▼               ▼
[ Client 1 ]     [ Client 2 ]    [ Client 100,000 ]
```

## API Endpoints

- `GET /events` (or `/api/live-feed`): Server-Sent Events stream for live feed events.
- `GET /health`: JSON status check (`{"status": "healthy"}`).
- `GET /stats`: Real-time subscriber metrics (`{"active_clients": 1250, ...}`).

## Environment Variables

| Variable             | Default                                                     | Description                             |
| -------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`       | `postgres://postgres:postgres@localhost:5432/campusconnect` | PostgreSQL connection string            |
| `LISTEN_CHANNEL`     | `live_feed_channel`                                         | Postgres NOTIFY channel name            |
| `PORT`               | `8081`                                                      | HTTP server port                        |
| `HOST`               | `0.0.0.0`                                                   | Bind host address                       |
| `BROADCAST_CAPACITY` | `10000`                                                     | Tokio broadcast channel buffer capacity |
| `KEEP_ALIVE_SECS`    | `15`                                                        | SSE keep-alive heartbeat interval       |

## Running Locally

### Prerequisites

- Cargo / Rust (1.80+) or Docker.

### Standalone Rust Build

```bash
cargo build --release
./target/release/realtime-proxy
```

### Docker

```bash
docker build -t realtime-proxy .
docker run -p 8081:8081 -e DATABASE_URL="postgres://user:pass@host:5432/db" realtime-proxy
```
