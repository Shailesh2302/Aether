from typing import List
from docx import Document
from app.core.logger import app_logger


class DocxLoader:
    async def load_file(self, file_path: str) -> List[str]:
        app_logger.info(f"Loading DOCX: {file_path}")
        doc = Document(file_path)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return paragraphs if paragraphs else [""]
