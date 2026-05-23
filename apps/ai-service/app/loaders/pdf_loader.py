from typing import List
import pypdf
import pdfplumber
from app.core.logger import app_logger


class PDFLoader:
    async def load_file(self, file_path: str) -> List[str]:
        app_logger.info(f"Loading PDF: {file_path}")
        try:
            with pdfplumber.open(file_path) as pdf:
                pages = []
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages.append(text)
                if pages:
                    return pages
        except Exception as e:
            app_logger.warning(f"pdfplumber failed, falling back to pypdf: {e}")

        text_parts = []
        with open(file_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

        return text_parts if text_parts else [""]
