use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
    response::Json,
    routing::get,
    Router,
};
use futures_util::stream::Stream;
use serde_json::json;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::broadcaster::Broadcaster;
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub broadcaster: Arc<Broadcaster>,
    pub config: Config,
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/events", get(sse_handler))
        .route("/api/live-feed", get(sse_handler))
        .route("/health", get(health_handler))
        .route("/stats", get(stats_handler))
        .layer(cors)
        .with_state(state)
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }))
}

async fn stats_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let active_clients = state.broadcaster.active_client_count();
    Json(json!({
        "active_clients": active_clients,
        "listen_channel": state.config.listen_channel,
        "broadcast_capacity": state.config.broadcast_capacity,
    }))
}

async fn sse_handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let (rx, _guard) = state.broadcaster.subscribe();
    let stream = BroadcastStream::new(rx);

    let event_stream = stream.filter_map(move |msg| match msg {
        Ok(broadcast_msg) => {
            let sse_event = Event::default()
                .event("message")
                .data(broadcast_msg.payload.as_ref());
            Some(Ok(sse_event))
        }
        Err(_lagged) => {
            // Client lagged behind broadcast queue
            let warning_event = Event::default()
                .event("warning")
                .data(r#"{"error":"message_overflow_lagged"}"#);
            Some(Ok(warning_event))
        }
    });

    let keep_alive_interval = Duration::from_secs(state.config.keep_alive_secs);

    Sse::new(event_stream).keep_alive(
        KeepAlive::new()
            .interval(keep_alive_interval)
            .text("heartbeat"),
    )
}
