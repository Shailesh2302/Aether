use std::process::Stdio;
use tokio::process::Command;
use tracing::{info};

pub async fn extract(input: &str, output: &str) -> anyhow::Result<()> {
    info!("Extracting audio from {} to {}", input, output);

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-i", input,
        "-vn",
        "-acodec", "libmp3lame",
        "-ab", "192k",
        "-ar", "44100",
        "-ac", "2",
        output,
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("FFmpeg failed: {}", stderr);
    }

    info!("Audio extracted successfully");
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
        "libmp3lame".to_string(),
        "-ab".to_string(),
        "192k".to_string(),
    ]);

    if let Some(dur) = duration {
        args.push("-t".to_string());
        args.push(dur.to_string());
    }

    args.push(output.to_string());

    let mut cmd = Command::new("ffmpeg");
    cmd.args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("FFmpeg failed: {}", stderr);
    }

    Ok(())
}