use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tokio_postgres::NoTls;
use tracing::{error, info, warn};

use crate::broadcaster::Broadcaster;
use crate::config::Config;

pub async fn run_postgres_listener(config: Config, broadcaster: Arc<Broadcaster>) {
    let channel_name = config.listen_channel.clone();
    let mut retry_delay_secs = 1u64;

    loop {
        info!("Connecting to PostgreSQL database for NOTIFY listening...");
        match tokio_postgres::connect(&config.database_url, NoTls).await {
            Ok((client, mut connection)) => {
                info!("Successfully connected to Postgres NOTIFY engine.");
                retry_delay_secs = 1; // Reset delay on successful connection

                // Spawn connection handler task
                let stream_task = tokio::spawn(async move {
                    if let Err(e) = futures_util::future::poll_fn(|cx| connection.poll_message(cx)).await {
                        error!("Postgres connection error: {}", e);
                    }
                });

                let listen_query = format!("LISTEN {};", channel_name);
                if let Err(e) = client.execute(&listen_query, &[]).await {
                    error!("Failed to execute LISTEN command '{}': {}", listen_query, e);
                    stream_task.abort();
                    sleep(Duration::from_secs(retry_delay_secs)).await;
                    continue;
                }

                info!("Listening for notifications on channel: {}", channel_name);

                // Receive notifications loop
                let notifications = client.notifications();
                tokio::pin!(notifications);

                while let Some(res) = futures_util::StreamExt::next(&mut notifications).await {
                    match res {
                        Ok(notification) => {
                            let payload = notification.payload();
                            let channel = notification.channel().to_string();
                            let sub_count = broadcaster.publish(channel, payload);
                            tracing::debug!("Received NOTIFY on '{}': {} bytes ({} receivers)", notification.channel(), payload.len(), sub_count);
                        }
                        Err(e) => {
                            warn!("Error receiving Postgres notification: {}", e);
                            break;
                        }
                    }
                }

                stream_task.abort();
                warn!("Postgres listener stream disconnected. Preparing reconnection...");
            }
            Err(e) => {
                error!("Failed to connect to Postgres: {}", e);
            }
        }

        info!("Retrying Postgres connection in {} seconds...", retry_delay_secs);
        sleep(Duration::from_secs(retry_delay_secs)).await;
        retry_delay_secs = (retry_delay_secs * 2).min(30);
    }
}
