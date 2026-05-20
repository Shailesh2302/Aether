use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, warn};

pub async fn extract(input: &str, output: &str) -> anyhow::Result<()> {
    info!("Extracting audio from {} to {}", input, output);

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-i", input,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("FFmpeg audio extraction failed: {}", stderr);
    }

    info!("Audio extracted successfully to {}", output);
    Ok(())
}

pub async fn extract_with_options(
    input: &str,
    output: &str,
    start_time: Option<f64>,
    duration: Option<f64>,
) -> anyhow::Result<()> {
    let mut args = vec!["-y".to_string(), "-i".to_string(), input.to_string()];

    if let Some(start) = start_time {
        args.push("-ss".to_string());
        args.push(start.to_string());
    }

    args.extend([
        "-vn".to_string(),
        "-acodec".to_string(),
        "pcm_s16le".to_string(),
        "-ar".to_string(),
        "16000".to_string(),
        "-ac".to_string(),
        "1".to_string(),
    ]);

    if let Some(dur) = duration {
        args.push("-t".to_string());
        args.push(dur.to_string());
    }

    args.push(output.to_string());

    let mut cmd = Command::new("ffmpeg");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        warn!("FFmpeg audio extraction with options failed: {}", stderr);
        anyhow::bail!("FFmpeg failed: {}", stderr);
    }

    Ok(())
}