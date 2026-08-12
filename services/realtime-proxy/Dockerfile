# Build Stage
FROM rust:1.80-slim as builder

WORKDIR /usr/src/realtime-proxy

# Copy Cargo manifests
COPY Cargo.toml ./

# Build dependencies dummy step for caching
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "pub mod broadcaster; pub mod config; pub mod listener; pub mod sse;" > src/lib.rs
RUN cargo build --release
RUN rm -f target/release/deps/realtime_proxy*

# Copy actual source files
COPY src ./src

# Build production binary
RUN cargo build --release

# Runtime Stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /usr/src/realtime-proxy/target/release/realtime-proxy /app/realtime-proxy

ENV PORT=8081
ENV HOST=0.0.0.0
ENV LISTEN_CHANNEL=live_feed_channel

EXPOSE 8081

CMD ["/app/realtime-proxy"]
