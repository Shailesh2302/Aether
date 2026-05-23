from app.loaders.pdf_loader import PDFLoader
from app.loaders.docx_loader import DocxLoader
from app.loaders.excel_loader import ExcelLoader
from app.loaders.video_loader import VideoLoader

pdf_loader = PDFLoader()
docx_loader = DocxLoader()
excel_loader = ExcelLoader()
video_loader = VideoLoader()

__all__ = ["pdf_loader", "docx_loader", "excel_loader", "video_loader"]
