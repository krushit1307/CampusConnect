use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use realtime_proxy::broadcaster::Broadcaster;
use realtime_proxy::config::Config;
use realtime_proxy::listener::run_postgres_listener;
use realtime_proxy::sse::{create_router, AppState};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing subscriber
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

    info!("Starting Realtime HTTP/2 SSE Proxy Service...");

    // Load Configuration
    let config = Config::from_env();
    info!(
        "Configured to listen on channel '{}' with capacity {}",
        config.listen_channel, config.broadcast_capacity
    );

    // Initialize Broadcaster
    let broadcaster = Arc::new(Broadcaster::new(config.broadcast_capacity));

    // Spawn Postgres Listener in background task
    let listener_config = config.clone();
    let listener_broadcaster = Arc::clone(&broadcaster);
    tokio::spawn(async move {
        run_postgres_listener(listener_config, listener_broadcaster).await;
    });

    // Build Axum Router
    let app_state = AppState {
        broadcaster: Arc::clone(&broadcaster),
        config: config.clone(),
    };
    let app = create_router(app_state);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    info!("Realtime Proxy listening for SSE connections on http://{}", addr);
    info!("Endpoints: SSE stream: http://{}/events | Health: http://{}/health | Stats: http://{}/stats", addr, addr, addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Realtime Proxy Service shut down cleanly.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received, initiating graceful teardown...");
}
