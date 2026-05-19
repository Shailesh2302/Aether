pub mod extract_audio;
pub mod generate_clip;
pub mod get_metadata;
pub mod thumbnails;

use std::process::Stdio;
use tokio::process::Command;
use tokio::io::AsyncReadExt;
use tracing::{info, debug};

pub struct Ffmpeg {
    path: Option<String>,
}

impl Ffmpeg {
    pub fn new(path: Option<String>) -> Self {
        Self { path }
    }

    pub fn command(&self) -> Command {
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
}

pub async fn get_metadata(path: &str) -> anyhow::Result<String> {
    Ok("metadata".to_string())
}