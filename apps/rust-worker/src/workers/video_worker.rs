use std::sync::Arc;
use std::path::Path;
use tracing::{info, warn};
use tokio::fs;
use reqwest::Client;
use tokio::io::AsyncReadExt;

use crate::queue::jobs::QueueJob;
use crate::AppState;
use crate::ffmpeg::Ffmpeg;

pub struct VideoWorker {
    app_state: Arc<AppState>,
    http_client: Client,
}

impl VideoWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self {
            app_state,
            http_client: Client::new(),
        }
    }

    fn get_storage_path(&self) -> String {
        std::env::var("STORAGE_BASE_PATH")
            .unwrap_or_else(|_| "/home/shailesh/Desktop/omnimind/storage".to_string())
    }

    fn resolve_file_path(&self, path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            return path.to_string();
        }
        if Path::new(path).is_absolute() {
            return path.to_string();
        }
        let storage = self.get_storage_path();
        format!("{}/uploads/{}", storage, path)
    }

    async fn download_if_url(&self, url: &str, local_path: &str) -> anyhow::Result<()> {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Ok(());
        }

        info!("Downloading file from {} to {}", url, local_path);

        let response = self.http_client.get(url).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("Failed to download file: HTTP {}", response.status());
        }

        let bytes = response.bytes().await?;
        fs::create_dir_all(Path::new(local_path).parent().unwrap_or(Path::new("."))).await?;
        fs::write(local_path, bytes).await?;

        info!("File downloaded successfully");
        Ok(())
    }

    async fn send_to_transcription(&self, audio_path: &str) -> anyhow::Result<String> {
        info!("Sending audio to transcription service: {}", audio_path);

        let mut file = tokio::fs::File::open(audio_path).await?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).await?;

        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| anyhow::anyhow!("Failed to create multipart part: {}", e))?;

        let form = reqwest::multipart::Form::new()
            .part("audio", part);

        let response = self.http_client
            .post("http://localhost:3002/api/v1/transcription")
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Transcription service failed: HTTP {} - {}", status, body);
        }

        let result: serde_json::Value = response.json().await?;
        let text = result.get("text")
            .or_else(|| result.get("transcription"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        info!("Transcription received ({} chars)", text.len());
        Ok(text)
    }

    async fn index_in_qdrant(&self, file_id: &str, text: &str, metadata: serde_json::Value) -> anyhow::Result<()> {
        info!("Indexing text in Qdrant for file: {}", file_id);

        let payload = serde_json::json!({
            "fileId": file_id,
            "text": text,
            "metadata": metadata,
        });

        let response = self.http_client
            .post("http://localhost:3001/api/search/index")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            warn!("Qdrant indexing returned: HTTP {}", response.status());
        } else {
            info!("Text indexed in Qdrant successfully");
        }

        Ok(())
    }

    async fn update_file_status(&self, file_id: &str) -> anyhow::Result<()> {
        info!("Updating file status to COMPLETED: {}", file_id);

        let response = self.http_client
            .patch(&format!("http://localhost:3001/api/files/{}", file_id))
            .json(&serde_json::json!({ "status": "COMPLETED" }))
            .send()
            .await?;

        if !response.status().is_success() {
            warn!("Failed to update file status: HTTP {}", response.status());
        } else {
            info!("File status updated to COMPLETED");
        }

        Ok(())
    }

    pub async fn process(&self, job: QueueJob) -> anyhow::Result<()> {
        info!("Processing video job: {}", job.id);

        let input_path = self.resolve_file_path(&job.input_path);
        let file_id = &job.video_id;
        let storage_path = self.get_storage_path();

        let video_path = if input_path.starts_with("http://") || input_path.starts_with("https://") {
            let temp_path = format!("{}/uploads/temp_{}.mp4", storage_path, job.id);
            self.download_if_url(&input_path, &temp_path).await?;
            temp_path
        } else {
            input_path.clone()
        };

        info!("Processing video file: {}", video_path);

        let ffmpeg = Ffmpeg::new(None);

        let audio_path = format!("{}/audio/{}.wav", storage_path, job.id);
        fs::create_dir_all(format!("{}/audio", storage_path)).await?;

        info!("Extracting audio from video...");
        ffmpeg.extract_audio(&video_path, &audio_path).await?;

        info!("Sending audio for transcription...");
        let transcription = self.send_to_transcription(&audio_path).await?;

        let metadata = serde_json::json!({
            "jobId": job.id,
            "videoId": file_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        self.index_in_qdrant(file_id, &transcription, metadata).await?;

        self.update_file_status(file_id).await?;

        let thumb_dir = format!("{}/thumbnails", storage_path);
        fs::create_dir_all(&thumb_dir).await?;

        let thumbnail_path = format!("{}/{}.jpg", thumb_dir, file_id);
        info!("Generating thumbnail...");
        ffmpeg.generate_thumbnail(&video_path, &thumbnail_path, 0.0).await?;

        let _ = fs::remove_file(&audio_path).await;

        info!("Video job {} completed successfully", job.id);
        Ok(())
    }
}