pub mod extract_audio;
pub mod generate_clip;
pub mod get_metadata;
pub mod thumbnails;

use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, debug};

#[derive(Debug, Clone)]
pub struct VideoMetadata {
    pub duration_sec: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub bitrate: Option<u64>,
    pub fps: Option<f64>,
}

pub struct Ffmpeg {
    path: Option<String>,
}

impl Ffmpeg {
    pub fn new(path: Option<String>) -> Self {
        Self { path }
    }

    fn command(&self) -> Command {
        let mut cmd = Command::new(self.path.as_deref().unwrap_or("ffmpeg"));
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }

    pub async fn probe(&self, input: &str) -> anyhow::Result<String> {
        let mut cmd = Command::new("ffprobe");
        cmd.args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            input,
        ]);

        let output = cmd.output().await?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    pub fn get_path(&self) -> &str {
        self.path.as_deref().unwrap_or("ffmpeg")
    }

    pub async fn extract_audio(&self, input_path: &str, output_path: &str) -> anyhow::Result<()> {
        extract_audio::extract(input_path, output_path).await
    }

    pub async fn generate_clip(&self, input_path: &str, output_path: &str, start_sec: f64, end_sec: f64) -> anyhow::Result<()> {
        generate_clip::generate(input_path, output_path, start_sec, end_sec).await
    }

    pub async fn generate_thumbnail(&self, input_path: &str, output_path: &str, timestamp_sec: f64) -> anyhow::Result<()> {
        thumbnails::generate(input_path, output_path, timestamp_sec).await
    }

    pub async fn get_metadata(&self, path: &str) -> anyhow::Result<VideoMetadata> {
        get_metadata::get_metadata(path).await
    }
}

pub async fn get_metadata(path: &str) -> anyhow::Result<String> {
    Ok("metadata".to_string())
}