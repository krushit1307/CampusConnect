use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub listen_channel: String,
    pub port: u16,
    pub host: String,
    pub broadcast_capacity: usize,
    pub keep_alive_secs: u64,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/campusconnect".to_string());

        let listen_channel = env::var("LISTEN_CHANNEL")
            .unwrap_or_else(|_| "live_feed_channel".to_string());

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8081);

        let host = env::var("HOST")
            .unwrap_or_else(|_| "0.0.0.0".to_string());

        let broadcast_capacity = env::var("BROADCAST_CAPACITY")
            .ok()
            .and_then(|c| c.parse::<usize>().ok())
            .unwrap_or(10_000);

        let keep_alive_secs = env::var("KEEP_ALIVE_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(15);

        Self {
            database_url,
            listen_channel,
            port,
            host,
            broadcast_capacity,
            keep_alive_secs,
        }
    }
}
