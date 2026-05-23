use std::sync::Arc;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use tokio::sync::Mutex;
use tracing::info;

pub struct RedisClient {
    conn: Arc<Mutex<ConnectionManager>>,
}

impl RedisClient {
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(url)?;
        let conn = ConnectionManager::new(client).await?;
        info!("Redis client connected to {}", url);
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub async fn lpush(&self, key: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.conn.lock().await;
        conn.lpush::<&str, &str, ()>(key, value).await?;
        Ok(())
    }

    pub async fn rpush(&self, key: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.conn.lock().await;
        conn.rpush::<&str, &str, ()>(key, value).await?;
        Ok(())
    }

    pub async fn brpop(&self, key: &str, timeout: f64) -> anyhow::Result<Option<String>> {
        let mut conn = self.conn.lock().await;
        let result: Option<(String, String)> = conn
            .brpop(key, timeout)
            .await?;
        Ok(result.map(|(_key, value)| value))
    }

    pub async fn set(&self, key: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.conn.lock().await;
        conn.set::<&str, &str, ()>(key, value).await?;
        Ok(())
    }

    pub async fn get(&self, key: &str) -> anyhow::Result<Option<String>> {
        let mut conn = self.conn.lock().await;
        let result: Option<String> = conn.get(key).await?;
        Ok(result)
    }

    pub async fn hset(&self, key: &str, field: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.conn.lock().await;
        conn.hset::<&str, &str, &str, ()>(key, field, value).await?;
        Ok(())
    }

    pub async fn hget(&self, key: &str, field: &str) -> anyhow::Result<Option<String>> {
        let mut conn = self.conn.lock().await;
        let result: Option<String> = conn.hget(key, field).await?;
        Ok(result)
    }

    pub async fn llen(&self, key: &str) -> anyhow::Result<usize> {
        let mut conn = self.conn.lock().await;
        let result: usize = conn.llen(key).await?;
        Ok(result)
    }
}
