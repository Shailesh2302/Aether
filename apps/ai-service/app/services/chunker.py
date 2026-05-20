import re
from typing import List, Optional
from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()


class TextChunker:
    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        app_logger.info(
            f"TextChunker initialized: size={self.chunk_size}, overlap={self.chunk_overlap}"
        )

    def chunk_text(
        self,
        text: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> List[str]:
        chunk_size = chunk_size or self.chunk_size
        chunk_overlap = chunk_overlap or self.chunk_overlap

        if not text or not text.strip():
            return []

        text = self._preprocess_text(text)

        sentences = self._split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence_len = self._estimate_tokens(sentence)

            if current_length + sentence_len > chunk_size and current_chunk:
                chunk_text = self._join_chunks(current_chunk)
                chunks.append(chunk_text)

                overlap_text = self._get_overlap_text(current_chunk, chunk_overlap)
                current_chunk = [overlap_text] if overlap_text else []
                current_length = self._estimate_tokens(overlap_text) if overlap_text else 0

            current_chunk.append(sentence)
            current_length += sentence_len

        if current_chunk:
            chunks.append(self._join_chunks(current_chunk))

        app_logger.info(f"Chunked text into {len(chunks)} chunks")
        return chunks

    def _preprocess_text(self, text: str) -> str:
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)
        return text.strip()

    def _split_into_sentences(self, text: str) -> List[str]:
        sentence_pattern = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_pattern, text)

        result = []
        for sent in sentences:
            sent = sent.strip()
            if sent:
                result.append(sent)

        if not result and text:
            result = [text]

        return result

    def _estimate_tokens(self, text: str) -> int:
        return len(text.split())

    def _join_chunks(self, chunks: List[str]) -> str:
        return ' '.join(chunks)

    def _get_overlap_text(self, chunks: List[str], overlap_tokens: int) -> str:
        if not chunks or overlap_tokens <= 0:
            return ""

        all_text = ' '.join(chunks)
        words = all_text.split()

        if len(words) <= overlap_tokens:
            return all_text

        return ' '.join(words[-overlap_tokens:])


class SemanticChunker(TextChunker):
    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
    ):
        super().__init__(chunk_size, chunk_overlap)

    def chunk_by_paragraphs(self, text: str) -> List[str]:
        paragraphs = re.split(r'\n\s*\n', text)
        chunks = []
        current_chunk = []
        current_length = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_len = self._estimate_tokens(para)

            if current_length + para_len > self.chunk_size and current_chunk:
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = [para]
                current_length = para_len
            else:
                current_chunk.append(para)
                current_length += para_len

        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))

        return chunks


chunker = TextChunker()
semantic_chunker = SemanticChunker()