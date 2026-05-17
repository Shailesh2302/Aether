use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::sync::mpsc;
use futures::stream::{StreamExt, SplitSink};
use futures::SinkExt;
use tokio_tungstenite::{accept_async_async, WebSocketStream};
use tokio::net::TcpListener;
use tracing::{info, error, debug};

type WsMessage = tokio_tungstenite::tungstenite::Message;

use crate::types::ProcessingStatus;
use crate::AppState;

pub struct WebSocketManager {
    clients: HashMap<String, mpsc::Sender<String>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
        }
    }

    pub async fn register_client(&mut self, id: String, sender: mpsc::Sender<String>) {
        self.clients.insert(id.clone(), sender);
        debug!("Client registered: {}", id);
    }

    pub async fn unregister_client(&mut self, id: &str) {
        self.clients.remove(id);
        debug!("Client unregistered: {}", id);
    }

    pub async fn send_to_client(&self, id: &str, message: &str) -> anyhow::Result<()> {
        if let Some(sender) = self.clients.get(id) {
            sender.send(message.to_string()).await?;
        }
        Ok(())
    }

    pub async fn broadcast_progress(&self, video_id: &str, status: ProcessingStatus, progress: u8) {
        let message = serde_json::json!({
            "type": "progress",
            "videoId": video_id,
            "status": status.to_string(),
            "progress": progress,
        }).to_string();

        for (_, sender) in &self.clients {
            let _ = sender.send(message.clone()).await;
        }
    }

    pub async fn broadcast_message(&self, message: &str) {
        for (_, sender) in &self.clients {
            let _ = sender.send(message.to_string()).await;
        }
    }

    pub fn client_count(&self) -> usize {
        self.clients.len()
    }
}

pub async fn run_websocket_server(app_state: Arc<AppState>) -> anyhow::Result<()> {
    let addr = format!("{}:{}", app_state.config.ws_host, app_state.config.ws_port);
    let listener = TcpListener::bind(&addr).await?;

    info!("WebSocket server listening on {}", addr);

    loop {
        let (stream, addr) = listener.accept().await?;
        info!("New WebSocket connection from: {}", addr);

        let app_state = app_state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, app_state).await {
                error!("WebSocket connection error: {}", e);
            }
        });
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    app_state: Arc<AppState>,
) -> anyhow::Result<()> {
    let ws_stream = accept_async_async(stream).await?;
    let (mut write, mut read) = ws_stream.split();

    let (tx, mut rx) = mpsc::channel::<String>(100);
    let client_id = uuid::Uuid::new_v4().to_string();

    {
        let mut manager = app_state.ws_manager.write().await;
        manager.register_client(client_id.clone(), tx).await;
    }

    let writer_handle = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(WsMessage::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    while let Some(msg) = read.next().await {
        match msg {
            Ok(WsMessage::Text(text)) => {
                debug!("Received from {}: {}", client_id, text);
                handle_message(&client_id, &text, &app_state).await;
            }
            Ok(WsMessage::Close(_)) => break,
            Err(e) => {
                error!("WebSocket read error: {}", e);
                break;
            }
            _ => {}
        }
    }

    writer_handle.abort();

    let mut manager = app_state.ws_manager.write().await;
    manager.unregister_client(&client_id).await;

    info!("WebSocket connection closed: {}", client_id);
    Ok(())
}

async fn handle_message(client_id: &str, message: &str, app_state: &Arc<AppState>) {
    if let Ok(msg) = serde_json::from_str::<serde_json::Value>(message) {
        match msg.get("type").and_then(|v| v.as_str()) {
            Some("subscribe") => {
                if let Some(video_id) = msg.get("videoId").and_then(|v| v.as_str()) {
                    debug!("Client {} subscribing to video {}", client_id, video_id);
                }
            }
            Some("ping") => {
                let response = serde_json::json!({
                    "type": "pong",
                    "clientId": client_id,
                });
                if let Some(manager) = app_state.ws_manager.read().await.clients.get(client_id) {
                    let _ = manager.send(response.to_string()).await;
                }
            }
            _ => {}
        }
    }
}