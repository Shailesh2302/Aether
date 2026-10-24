import base64
import os
import re
import tempfile
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.dependencies import API_KEY_DEP
from app.core.logger import app_logger

router = APIRouter(tags=["import"])

MAX_IMPORT_BYTES = 500 * 1024 * 1024

_EXT_BY_CONTENT_TYPE = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
}

_cookie_path: Optional[str] = None


def _cookies_path() -> Optional[str]:
    """Resolve a Netscape cookies.txt from YTDLP_COOKIES_FILE or YTDLP_COOKIES_B64.

    YouTube blocks downloads from datacenter IPs with a "confirm you're not a
    bot" check; an authenticated cookie export is the supported workaround.
    """
    global _cookie_path
    explicit = os.environ.get("YTDLP_COOKIES_FILE")
    if explicit:
        if os.path.isfile(explicit):
            return explicit
        app_logger.warning(f"YTDLP_COOKIES_FILE is set but not a file: {explicit}")

    encoded = os.environ.get("YTDLP_COOKIES_B64")
    if encoded:
        if _cookie_path and os.path.exists(_cookie_path):
            return _cookie_path
        try:
            raw = base64.b64decode(encoded, validate=True)
            path = os.path.join(tempfile.gettempdir(), "aether-ytdlp-cookies.txt")
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "wb") as fh:
                fh.write(raw)
            _cookie_path = path
            return path
        except Exception as exc:
            app_logger.error(f"Could not decode YTDLP_COOKIES_B64: {exc}")
    return None


def _ytdlp_options() -> dict:
    opts: dict = {}
    cookies = _cookies_path()
    if cookies:
        opts["cookiefile"] = cookies
    return opts


def _clean_title(title: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\r\n\t]+', " ", title or "").strip()
    return cleaned[:200] or "imported-video"


def _friendly_error(exc: Exception) -> str:
    """Turn yt-dlp's verbose failures into something the UI can show."""
    text = str(exc)
    low = text.lower()
    if "sign in to confirm" in low or "not a bot" in low:
        return (
            "YouTube blocked this download from the server (bot check). "
            "YouTube imports require a cookies.txt export; set YTDLP_COOKIES_FILE "
            "or YTDLP_COOKIES_B64 on the AI service. Direct video URLs work without cookies."
        )
    if "http error 403" in low:
        return (
            "YouTube refused the download (HTTP 403). Configure YouTube cookies "
            "(YTDLP_COOKIES_FILE / YTDLP_COOKIES_B64) and try again."
        )
    if "video unavailable" in low or "private video" in low or "age" in low and "restricted" in low:
        return "This video is unavailable, private, or age-restricted."
    first_line = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    return first_line[:300] or "Failed to download remote media"


class ImportInfoRequest(BaseModel):
    url: str


class ImportInfoResponse(BaseModel):
    title: str
    extension: str
    duration_sec: Optional[float] = None
    source: str


def _is_supported_url(url: str) -> bool:
    try:
        parts = urlparse(url)
        return parts.scheme in ("http", "https") and bool(parts.netloc)
    except Exception:
        return False


@router.post("/import/info", response_model=ImportInfoResponse)
async def import_info(
    request: ImportInfoRequest,
    api_key: API_KEY_DEP = None,
) -> ImportInfoResponse:
    if not _is_supported_url(request.url):
        raise HTTPException(status_code=400, detail="Only http(s) URLs can be imported")

    host = (urlparse(request.url).netloc or "").lower()
    is_video_site = any(
        d in host for d in ("youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "twitch.tv")
    )

    if is_video_site:
        try:
            import yt_dlp

            ydl_opts = {"quiet": True, "no_warnings": True, "noplaylist": True, **_ytdlp_options()}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(request.url, download=False)
            title = (info or {}).get("title") or "imported-video"
            duration = (info or {}).get("duration")
            return ImportInfoResponse(
                title=_clean_title(str(title)), extension="mp4",
                duration_sec=float(duration) if duration else None,
                source="youtube",
            )
        except HTTPException:
            raise
        except Exception as e:
            app_logger.error(f"yt-dlp info failed: {e}")
            raise HTTPException(status_code=422, detail=_friendly_error(e))

    # Direct file URL - sniff headers only.
    import httpx

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.head(request.url)
            ctype = (resp.headers.get("content-type") or "").split(";")[0].strip()
            name = os.path.basename(urlparse(str(resp.url)).path) or "imported-file"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"URL is not reachable: {e}")

    ext = os.path.splitext(name)[1].lower().lstrip(".") or "mp4"
    return ImportInfoResponse(title=name, extension=ext, duration_sec=None, source=ctype or "direct")


@router.get("/import/download")
async def import_download(
    url: str,
    api_key: API_KEY_DEP = None,
):
    """Download remote media to a temp file and stream it back to the API."""
    if not _is_supported_url(url):
        raise HTTPException(status_code=400, detail="Only http(s) URLs can be imported")

    host = (urlparse(url).netloc or "").lower()
    is_video_site = any(
        d in host for d in ("youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "twitch.tv")
    )

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".media")
    tmp_path = tmp.name
    tmp.close()
    title = "imported-video"
    ext_from_ctype = ""

    try:
        if is_video_site:
            import yt_dlp

            def hook(d):
                if d.get("status") == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                    if total and total > MAX_IMPORT_BYTES:
                        raise HTTPException(status_code=413, detail="Video exceeds the 500 MB import limit")

            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                # YouTube serves video/audio separately; pick the best
                # streams and let ffmpeg merge them. A pre-merged "best"
                # is kept as a last resort.
                "format": "bv*[filesize<500M]+ba/b[filesize<500M]/b",
                "outtmpl": tmp_path + ".%(ext)s",
                "progress_hooks": [hook],
                "merge_output_format": "mp4",
                **_ytdlp_options(),
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = _clean_title(str((info or {}).get("title") or title))
            # yt-dlp appends the real extension.
            downloaded = tmp_path + ".mp4"
            if not os.path.exists(downloaded):
                import glob

                candidates = glob.glob(tmp_path + ".*")
                if not candidates:
                    raise HTTPException(status_code=502, detail="Download produced no file")
                downloaded = candidates[0]
            if os.path.getsize(downloaded) > MAX_IMPORT_BYTES:
                os.unlink(downloaded)
                raise HTTPException(status_code=413, detail="Video exceeds the 500 MB import limit")
            os.unlink(tmp_path) if os.path.exists(tmp_path) else None
            tmp_path = downloaded
        else:
            import httpx

            async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
                async with client.stream("GET", url) as resp:
                    if resp.status_code >= 400:
                        raise HTTPException(status_code=422, detail=f"Download failed (HTTP {resp.status_code})")
                    ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
                    ext_from_ctype = _EXT_BY_CONTENT_TYPE.get(ctype, "")
                    final_url = str(resp.url)
                    size = 0
                    with open(tmp_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(1024 * 256):
                            size += len(chunk)
                            if size > MAX_IMPORT_BYTES:
                                raise HTTPException(status_code=413, detail="File exceeds the 500 MB import limit")
                            f.write(chunk)
            title = os.path.basename(urlparse(final_url).path) or "imported-file"

        # Temp downloads end in .media; prefer the container's real extension.
        tmp_ext = os.path.splitext(tmp_path)[1].lower()
        if tmp_ext in ("", ".media"):
            ext = os.path.splitext(title)[1].lower() or ext_from_ctype or ".mp4"
        else:
            ext = tmp_ext
        base = os.path.splitext(title)[0] if os.path.splitext(title)[1] else title
        filename = f"{_clean_title(base)}{ext}"
        return FileResponse(
            tmp_path, filename=filename,
            headers={"X-Import-Title": filename},
        )
    except HTTPException:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        app_logger.error(f"Import download failed: {e}")
        raise HTTPException(status_code=502, detail=_friendly_error(e))
