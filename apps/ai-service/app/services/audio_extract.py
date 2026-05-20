import subprocess
import os
import tempfile
import asyncio
from typing import Optional
from app.core.logger import app_logger


class AudioExtractor:
    def __init__(self):
        self._check_ffmpeg()

    def _check_ffmpeg(self):
        try:
            subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                check=True,
            )
            app_logger.info("FFmpeg is available")
        except (subprocess.CalledProcessError, FileNotFoundError):
            app_logger.warning("FFmpeg not found - video audio extraction may fail")

    async def _check_audio_stream(self, video_path: str) -> bool:
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", video_path],
                capture_output=True,
                text=True,
            )
            return bool(result.stdout.strip())
        except Exception:
            return False

    async def extract_audio(
        self,
        video_path: str,
        output_format: str = "mp3",
        sample_rate: int = 16000,
    ) -> str:
        app_logger.info(f"Extracting audio from: {video_path}")

        has_audio = await self._check_audio_stream(video_path)
        if not has_audio:
            app_logger.warning(f"No audio stream found in: {video_path}, creating silent audio placeholder")
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{output_format}") as tmp_file:
                output_path = tmp_file.name
            command = [
                "ffmpeg",
                "-f", "lavfi",
                "-i", "anullsrc=r=16000:cl=mono",
                "-t", "1",
                "-y",
                output_path,
            ]
            await asyncio.to_thread(subprocess.run, command, capture_output=True)
            return output_path

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=f".{output_format}"
        ) as tmp_file:
            output_path = tmp_file.name

        try:
            command = [
                "ffmpeg",
                "-i", video_path,
                "-vn",
                "-acodec", "libmp3lame" if output_format == "mp3" else "pcm_s16le",
                "-ar", str(sample_rate),
                "-ac", "1",
                "-y",
                output_path,
            ]

            result = await asyncio.to_thread(
                subprocess.run,
                command,
                capture_output=True,
                check=True,
            )

            app_logger.info(f"Audio extracted to: {output_path}")
            return output_path

        except subprocess.CalledProcessError as e:
            app_logger.error(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
            if os.path.exists(output_path):
                os.unlink(output_path)
            raise RuntimeError(f"Failed to extract audio: {e}")

    async def get_audio_info(self, audio_path: str) -> dict:
        try:
            command = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration,size",
                "-show_entries", "stream=channels,sample_rate,codec_name",
                "-of", "json",
                audio_path,
            ]

            result = await asyncio.to_thread(
                subprocess.run,
                command,
                capture_output=True,
                check=True,
                text=True,
            )

            import json
            info = json.loads(result.stdout)

            duration = float(info.get("format", {}).get("duration", 0))
            channels = int(info.get("streams", [{}])[0].get("channels", 1))
            sample_rate = int(info.get("streams", [{}])[0].get("sample_rate", 0))

            return {
                "duration_sec": duration,
                "channels": channels,
                "sample_rate": sample_rate,
            }

        except Exception as e:
            app_logger.error(f"Error getting audio info: {e}")
            return {"duration_sec": 0, "channels": 1, "sample_rate": 0}


audio_extractor = AudioExtractor()