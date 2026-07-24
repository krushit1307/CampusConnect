use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{info, warn};

#[derive(Clone, Debug)]
pub struct BroadcastMessage {
    pub channel: String,
    pub payload: Arc<str>,
    pub timestamp: u64,
}

pub struct Broadcaster {
    sender: broadcast::Sender<BroadcastMessage>,
    active_connections: Arc<AtomicUsize>,
}

impl Broadcaster {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self {
            sender,
            active_connections: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub fn subscribe(&self) -> (broadcast::Receiver<BroadcastMessage>, ConnectionGuard) {
        self.active_connections.fetch_add(1, Ordering::SeqCst);
        let guard = ConnectionGuard {
            counter: Arc::clone(&self.active_connections),
        };
        (self.sender.subscribe(), guard)
    }

    pub fn publish(&self, channel: String, payload: impl Into<Arc<str>>) -> usize {
        let message = BroadcastMessage {
            channel,
            payload: payload.into(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        };

        match self.sender.send(message) {
            Ok(receiver_count) => {
                tracing::debug!("Broadcasted message to {} active subscribers", receiver_count);
                receiver_count
            }
            Err(_) => {
                // No active receivers currently
                0
            }
        }
    }

    pub fn active_client_count(&self) -> usize {
        self.active_connections.load(Ordering::Relaxed)
    }
}

pub struct ConnectionGuard {
    counter: Arc<AtomicUsize>,
}

impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        self.counter.fetch_sub(1, Ordering::SeqCst);
    }
}
