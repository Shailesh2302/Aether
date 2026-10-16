import os
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

            ydl_opts = {"quiet": True, "no_warnings": True, "noplaylist": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(request.url, download=False)
            title = (info or {}).get("title") or "imported-video"
            duration = (info or {}).get("duration")
            return ImportInfoResponse(
                title=str(title), extension="mp4",
                duration_sec=float(duration) if duration else None,
                source="youtube",
            )
        except Exception as e:
            app_logger.error(f"yt-dlp info failed: {e}")
            raise HTTPException(status_code=422, detail="Could not read video info from this URL")

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
                "format": "best[ext=mp4][filesize<500M]/best[filesize<500M]/best",
                "outtmpl": tmp_path + ".%(ext)s",
                "progress_hooks": [hook],
                "merge_output_format": "mp4",
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = str((info or {}).get("title") or title)
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
                    size = 0
                    with open(tmp_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(1024 * 256):
                            size += len(chunk)
                            if size > MAX_IMPORT_BYTES:
                                raise HTTPException(status_code=413, detail="File exceeds the 500 MB import limit")
                            f.write(chunk)
            title = os.path.basename(urlparse(url).path) or "imported-file"

        filename = f"{title}{os.path.splitext(tmp_path)[1]}"
        # Prefer the real container extension (temp files end in .media).
        real_ext = os.path.splitext(title)[1].lower() or os.path.splitext(urlparse(url).path)[1].lower()
        if real_ext and len(real_ext) <= 5:
            filename = f"{os.path.splitext(title)[0]}{real_ext}"
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
        raise HTTPException(status_code=502, detail="Failed to download remote media")
