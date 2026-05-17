use redis::{Client, AsyncCommands, RedisResult};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};

use crate::types::ProcessingStatus;

pub struct RedisClient {
    client: Client,
    connection: Arc<RwLock<Option<redis::aio::Connection>>>,
}

impl RedisClient {
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(url)?;
        let connection = client.get_async_handler().await?;

        info!("Connected to Redis: {}", url);

        Ok(Self {
            client,
            connection: Arc::new(RwLock::new(Some(connection))),
        })
    }

    pub async fn get_connection(&self) -> anyhow::Result<redis::aio::Connection> {
        let mut guard = self.connection.write().await;
        if let Some(conn) = guard.take() {
            Ok(conn)
        } else {
            let conn = self.client.get_async_handler().await?;
            Ok(conn)
        }
    }

    pub async fn return_connection(&self, conn: redis::aio::Connection) {
        let mut guard = self.connection.write().await;
        *guard = Some(conn);
    }

    pub async fn lpush<T: redis::ToRedisArgs>(&self, key: &str, value: T) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("LPUSH").arg(key).arg(value).query_async(&mut conn).await?;
        self.return_connection(conn).await;
        Ok(())
    }

    pub async fn rpush<T: redis::ToRedisArgs>(&self, key: &str, value: T) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("RPUSH").arg(key).arg(value).query_async(&mut conn).await?;
        self.return_connection(conn).await;
        Ok(())
    }

    pub async fn brpop(&self, key: &str, timeout: u64) -> anyhow::Result<Option<String>> {
        let mut conn = self.get_connection().await?;
        let result: Option<(String, String)> = redis::cmd("BRPOP")
            .arg(key)
            .arg(timeout)
            .query_async(&mut conn)
            .await;
        self.return_connection(conn).await;

        match result {
            Some((_, value)) => Ok(Some(value)),
            None => Ok(None),
        }
    }

    pub async fn set(&self, key: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("SET").arg(key).arg(value).query_async(&mut conn).await?;
        self.return_connection(conn).await;
        Ok(())
    }

    pub async fn get(&self, key: &str) -> anyhow::Result<Option<String>> {
        let mut conn = self.get_connection().await?;
        let result: Option<String> = redis::cmd("GET").arg(key).query_async(&mut conn).await?;
        self.return_connection(conn).await;
        Ok(result)
    }

    pub async fn del(&self, key: &str) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("DEL").arg(key).query_async(&mut conn).await?;
        self.return_connection(conn).await;
        Ok(())
    }

    pub async fn hset(&self, key: &str, field: &str, value: &str) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("HSET")
            .arg(key)
            .arg(field)
            .arg(value)
            .query_async(&mut conn)
            .await?;
        self.return_connection(conn).await;
        Ok(())
    }

    pub async fn hget(&self, key: &str, field: &str) -> anyhow::Result<Option<String>> {
        let mut conn = self.get_connection().await?;
        let result: Option<String> = redis::cmd("HGET")
            .arg(key)
            .arg(field)
            .query_async(&mut conn)
            .await?;
        self.return_connection(conn).await;
        Ok(result)
    }

    pub async fn hgetall(&self, key: &str) -> anyhow::Result<std::collections::HashMap<String, String>> {
        let mut conn = self.get_connection().await?;
        let result: std::collections::HashMap<String, String> = redis::cmd("HGETALL")
            .arg(key)
            .query_async(&mut conn)
            .await?;
        self.return_connection(conn).await;
        Ok(result)
    }

    pub async fn publish(&self, channel: &str, message: &str) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("PUBLISH")
            .arg(channel)
            .arg(message)
            .query_async(&mut conn)
            .await?;
        self.return_connection(conn).await;
        Ok(())
    }
}