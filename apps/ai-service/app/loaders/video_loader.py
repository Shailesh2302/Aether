from typing import List
from app.core.logger import app_logger


class VideoLoader:
    async def load_file(self, file_path: str) -> List[str]:
        app_logger.info(f"Video loader stub for: {file_path}")
        return [""]
