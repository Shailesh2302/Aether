# Upload Workflow

## Overview

The upload workflow handles file uploads, processing, and indexing into the vector database for semantic search.

## Workflow Diagram

```
┌─────────┐    ┌────────────┐    ┌───────────┐    ┌──────────┐
│  User   │───▶│   Upload   │───▶│  Process  │───▶│  Index   │
│ Uploads │    │   API      │    │   Queue   │    │   Qdrant │
└─────────┘    └────────────┘    └───────────┘    └──────────┘
                                        │
                                        ▼
                               ┌───────────────┐
                               │   Storage     │
                               │   (S3/MinIO)  │
                               └───────────────┘
```

## Step-by-Step Process

### 1. File Upload

**Endpoint**: `POST /api/v1/files/upload`

The user uploads a file through the frontend or API:

```bash
curl -X POST https://api.omnimind.ai/api/v1/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@document.pdf" \
  -F "collection_id=1"
```

**Validation**:
- File size check (max 100MB)
- File type validation
- Authentication check

**Response**:
```json
{
  "id": 1,
  "filename": "document.pdf",
  "status": "pending",
  "upload_url": null
}
```

### 2. File Storage

The uploaded file is stored:

1. Save to S3/MinIO with unique key
2. Generate file path identifier
3. Store metadata in PostgreSQL

**Storage Path**: `s3://omnimind-files/{user_id}/{file_id}/{filename}`

### 3. Processing Queue

The file is queued for processing:

```json
{
  "task_id": "task_123",
  "file_id": 1,
  "type": "process_file",
  "status": "queued"
}
```

### 4. Text Extraction

Extract text from the file:

| File Type | Method |
|-----------|--------|
| PDF | PyPDF2, pdfplumber |
| DOCX | python-docx |
| TXT | Native |
| HTML | BeautifulSoup |
| CSV | pandas |

**Output**:
```json
{
  "content": "Extracted text...",
  "metadata": {
    "pages": 10,
    "words": 5000
  }
}
```

### 5. Chunking

Split content into semantic chunks:

- **Chunk size**: 1000 characters
- **Overlap**: 100 characters
- **Strategy**: Recursive chunking by paragraphs

```python
def chunk_text(text: str) -> list[str]:
    chunks = []
    for i in range(0, len(text), chunk_size - overlap):
        chunks.append(text[i:i + chunk_size])
    return chunks
```

### 6. Embedding Generation

Generate vector embeddings for each chunk:

```python
def generate_embeddings(chunks: list[str]) -> list[list[float]]:
    response = openai.Embedding.create(
        model="text-embedding-ada-002",
        input=chunks
    )
    return [item.embedding for item in response.data]
```

### 7. Vector Indexing

Store embeddings in Qdrant:

```python
def index_vectors(collection_name: str, chunks: list, embeddings: list):
    qdrant_client.upsert(
        collection_name=collection_name,
        points=[
            PointStruct(
                id=i,
                vector=embeddings[i],
                payload={"text": chunks[i], "file_id": file_id}
            )
            for i in range(len(chunks))
        ]
    )
```

### 8. Status Update

Update file status in database:

```sql
UPDATE documents
SET status = 'indexed'
WHERE id = 1;
```

## Async Processing

For large files, processing is handled asynchronously:

1. **Upload** → Returns immediately with `status: processing`
2. **WebSocket** → Notifies client when processing completes
3. **Polling** → Client can poll status endpoint

## Error Handling

| Error | Action |
|-------|--------|
| Invalid file | Return 400, don't process |
| Storage failure | Retry 3 times, then fail |
| Processing error | Log error, set status to failed |
| Indexing error | Retry, then mark as failed |

## Monitoring

Track processing metrics:
- Upload rate
- Processing time
- Indexing latency
- Failure rate

## Retry Policy

- **Max retries**: 3
- **Backoff**: Exponential (1s, 2s, 4s)
- **DLQ**: Failed tasks after max retries