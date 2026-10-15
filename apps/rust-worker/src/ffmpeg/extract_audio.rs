use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, warn};

/// Preferred audio-track languages for transcription, highest priority first.
/// Configurable via AUDIO_LANGUAGES env (comma-separated ISO 639-2 codes).
fn preferred_languages() -> Vec<String> {
    std::env::var("AUDIO_LANGUAGES")
        .unwrap_or_else(|_| "eng,hin".to_string())
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Probe audio streams and return their (stream_index, language_tag) pairs.
async fn probe_audio_tracks(input: &str) -> Vec<(usize, String)> {
    let out = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-select_streams", "a",
            "-show_entries", "stream=index:stream_tags=language",
            "-of", "csv=p=0",
            input,
        ])
        .output()
        .await;

    let Ok(out) = out else { return vec![] };
    if !out.status.success() {
        return vec![];
    }

    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split(',').collect();
            // ffprobe emits "index,language" or just "index" when untagged
            let idx = parts.first()?.trim().parse::<usize>().ok()?;
            let lang = parts.get(1).unwrap_or(&"").trim().to_lowercase();
            Some((idx, lang))
        })
        .collect()
}

/// Pick the audio stream index best matching the preferred languages.
async fn pick_audio_stream(input: &str) -> Option<usize> {
    let tracks = probe_audio_tracks(input).await;
    if tracks.is_empty() {
        return None;
    }

    let prefs = preferred_languages();
    info!(
        "Audio tracks: {:?} | preference order: {:?}",
        tracks, prefs
    );

    for pref in &prefs {
        if let Some((idx, _)) = tracks.iter().find(|(_, lang)| lang == pref) {
            info!("Selected audio stream #{} (language: {})", idx, pref);
            return Some(*idx);
        }
    }
    None
}

pub async fn extract(input: &str, output: &str) -> anyhow::Result<()> {
    info!("Extracting audio from {} to {}", input, output);

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y").arg("-i").arg(input);

    // Prefer a user-language track when the container tags one.
    if let Some(idx) = pick_audio_stream(input).await {
        cmd.args(["-map", &format!("0:{}", idx)]);
    }

    cmd.args([
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

    if let Some(idx) = pick_audio_stream(input).await {
        args.push("-map".to_string());
        args.push(format!("0:{}", idx));
    }

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

/// Probe subtitle streams and return (stream_index, language_tag) pairs.
async fn probe_subtitle_tracks(input: &str) -> Vec<(usize, String)> {
    let out = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-select_streams", "s",
            "-show_entries", "stream=index:stream_tags=language",
            "-of", "csv=p=0",
            input,
        ])
        .output()
        .await;

    let Ok(out) = out else { return vec![] };
    if !out.status.success() {
        return vec![];
    }

    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split(',').collect();
            let idx = parts.first()?.trim().parse::<usize>().ok()?;
            let lang = parts.get(1).unwrap_or(&"").trim().to_lowercase();
            Some((idx, lang))
        })
        .collect()
}

/// Extract an embedded subtitle track as plain dialogue text.
/// Returns None when no preferred-language sub exists or it is empty/ad-free.
pub async fn extract_subtitle_text(input: &str) -> Option<String> {
    let tracks = probe_subtitle_tracks(input).await;
    if tracks.is_empty() {
        return None;
    }
    let prefs = preferred_languages();
    info!("Subtitle tracks: {:?} | preference: {:?}", tracks, prefs);

    let mut target: Option<usize> = None;
    'outer: for pref in &prefs {
        for (idx, lang) in &tracks {
            if lang == pref {
                target = Some(*idx);
                break 'outer;
            }
        }
    }
    let idx = target?;

    // Extract to a temp srt next to the output convention
    let srt_path = format!("/tmp/aether_subs_{}.srt", std::process::id());
    let out = Command::new("ffmpeg")
        .args(["-y", "-i", input, "-map", &format!("0:{}", idx), "-c:s", "srt", &srt_path])
        .output()
        .await
        .ok()?;
    if !out.status.success() {
        warn!("Subtitle extraction failed for stream {}", idx);
        let _ = tokio::fs::remove_file(&srt_path).await;
        return None;
    }

    let srt = tokio::fs::read_to_string(&srt_path).await.ok()?;
    let _ = tokio::fs::remove_file(&srt_path).await;

    let text = parse_srt_to_text(&srt);
    if text.len() < 60 {
        info!("Extracted subtitles too small ({} chars), ignoring", text.len());
        return None;
    }
    info!("Extracted {} chars of subtitle text from stream #{}", text.len(), idx);
    Some(text)
}

/// Convert SRT content into plain prose: drop indices, timestamps,
/// HTML formatting tags and watermark lines.
fn parse_srt_to_text(srt: &str) -> String {
    let mut lines_out: Vec<String> = Vec::new();
    for block in srt.split("\n\n") {
        for line in block.lines() {
            let l = line.trim();
            if l.is_empty()
                || l.chars().next().is_some_and(|c| c.is_ascii_digit()) && l.contains("-->")
                || l.parse::<usize>().is_ok() && line.trim().len() <= 6 && !line.contains(' ')
            {
                continue;
            }
            let mut cleaned: String = l
                .replace("<font color=\"#ff8000\">", "")
                .replace("</font>", "")
                .replace("{\\an8}", "");
            // strip any remaining simple html tags
            while let Some(start) = cleaned.find('<') {
                match cleaned[start..].find('>') {
                    Some(end_rel) => {
                        let end = start + end_rel + 1;
                        cleaned.replace_range(start..end, "");
                    }
                    None => break,
                }
            }
            let cleaned = cleaned.trim().to_string();
            if cleaned.is_empty() {
                continue;
            }
            let lower = cleaned.to_lowercase();
            if lower.contains("downloaded from") || lower.contains("moviesmod") {
                continue;
            }
            lines_out.push(cleaned);
        }
    }
    lines_out.join(" ")
}
