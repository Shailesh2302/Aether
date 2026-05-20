use std::process::Stdio;
use tokio::process::Command;
use tracing::info;

pub async fn generate(input: &str, output: &str, start: f64, end: f64) -> anyhow::Result<()> {
    info!("Generating clip from {} to {} ({}s - {}s)", input, output, start, end);

    let duration = end - start;

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-ss", &start.to_string(),
        "-i", input,
        "-t", &duration.to_string(),
        "-c", "copy",
        output,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("FFmpeg clip generation failed: {}", stderr);
    }

    info!("Clip generated successfully: {} ({}s duration)", output, duration);
    Ok(())
}