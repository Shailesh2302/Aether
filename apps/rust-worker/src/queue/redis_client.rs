use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Mutex;
use tracing::info;

pub struct RedisClient {
    storage: Arc<Mutex<HashMap<String, String>>>,
}

impl RedisClient {
    pub async fn new(_url: &str) -> anyhow::Result<Self> {
        info!("Redis client initialized (mock mode)");
        Ok(Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn lpush<T: std::fmt::Debug>(&self, key: &str, value: T) -> anyhow::Result<()> {
        info!("Queue push: {} -> {:?}", key, value);
        Ok(())
    }

    pub async fn rpush<T: std::fmt::Debug>(&self, _key: &str, _value: T) -> anyhow::Result<()> {
        Ok(())
    }

    pub async fn brpop(&self, _key: &str, timeout: u64) -> anyhow::Result<Option<String>> {
        tokio::time::sleep(tokio::time::Duration::from_secs(timeout)).await;
        Ok(None)
    }

    pub async fn set(&self, key: &str, value: &str) -> anyhow::Result<()> {
        self.storage.lock().unwrap().insert(key.to_string(), value.to_string());
        Ok(())
    }

    pub async fn get(&self, key: &str) -> anyhow::Result<Option<String>> {
        Ok(self.storage.lock().unwrap().get(key).cloned())
    }

    pub async fn hset(&self, key: &str, field: &str, value: &str) -> anyhow::Result<()> {
        let full_key = format!("{}:{}", key, field);
        self.storage.lock().unwrap().insert(full_key, value.to_string());
        Ok(())
    }

    pub async fn hget(&self, key: &str, field: &str) -> anyhow::Result<Option<String>> {
        let full_key = format!("{}:{}", key, field);
        Ok(self.storage.lock().unwrap().get(&full_key).cloned())
    }
}