use std::process::Stdio;
use tokio::process::Command;
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::ffmpeg::VideoMetadata;

#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    format: Option<FfprobeFormat>,
    streams: Option<Vec<FfprobeStream>>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
    bit_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
}

pub async fn get_metadata(input: &str) -> anyhow::Result<VideoMetadata> {
    info!("Getting metadata for: {}", input);

    let mut cmd = Command::new("ffprobe");
    cmd.args([
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        input,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("ffprobe failed: {}", stderr);
    }

    let json_str = String::from_utf8_lossy(&out.stdout);
    let output: FfprobeOutput = match serde_json::from_str(&json_str) {
        Ok(o) => o,
        Err(e) => {
            info!("Failed to parse ffprobe output: {}, using defaults", e);
            return Ok(VideoMetadata {
                duration_sec: 0.0,
                width: 1920,
                height: 1080,
                codec: "h264".to_string(),
                bitrate: None,
                fps: Some(30.0),
            });
        }
    };

    let duration_sec = output
        .format
        .as_ref()
        .and_then(|f| f.duration.as_ref())
        .and_then(|d| d.parse().ok())
        .unwrap_or(0.0);

    let bitrate = output
        .format
        .as_ref()
        .and_then(|f| f.bit_rate.as_ref())
        .and_then(|b| b.parse().ok());

    let video_stream = output
        .streams
        .as_ref()
        .and_then(|streams| streams.iter().find(|s| s.codec_type.as_deref() == Some("video")));

    let (width, height, codec, fps) = if let Some(vs) = video_stream {
        (
            vs.width.unwrap_or(1920),
            vs.height.unwrap_or(1080),
            vs.codec_name.clone().unwrap_or_else(|| "h264".to_string()),
            vs.r_frame_rate.as_ref().and_then(|r| {
                let parts: Vec<&str> = r.split('/').collect();
                if parts.len() == 2 {
                    let num: f64 = parts[0].parse().ok()?;
                    let den: f64 = parts[1].parse().ok()?;
                    if den > 0.0 {
                        Some(num / den)
                    } else {
                        None
                    }
                } else {
                    r.parse().ok()
                }
            }),
        )
    } else {
        (1920, 1080, "h264".to_string(), Some(30.0))
    };

    Ok(VideoMetadata {
        duration_sec,
        width,
        height,
        codec,
        bitrate,
        fps,
    })
}