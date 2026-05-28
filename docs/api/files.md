# Files API

## Overview

The Files API provides endpoints for uploading, managing, and processing files (documents, images, etc.).

## Base URL

```
https://api.aether.app/api/v1/files
```

## Endpoints

### Upload File

Upload a file for processing.

```
POST /upload
```

#### Headers

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Request Body

| Field | Type | Description |
|-------|------|-------------|
| file | File | The file to upload |
| collection_id | Integer | Target collection ID (optional) |
| metadata | JSON | Additional metadata (optional) |

#### Response (201 Created)

```json
{
  "id": 1,
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_size": 1024000,
  "status": "processing",
  "collection_id": 1,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### Errors

| Code | Description |
|------|-------------|
| 400 | Invalid file format |
| 413 | File too large (max 100MB) |
| 415 | Unsupported file type |

---

### List Files

Get all files for the authenticated user.

```
GET /files
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | Integer | Page number (default: 1) |
| limit | Integer | Items per page (default: 20) |
| collection_id | Integer | Filter by collection |
| status | String | Filter by status |

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "items": [
    {
      "id": 1,
      "filename": "document.pdf",
      "file_type": "pdf",
      "file_size": 1024000,
      "status": "indexed",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### Get File

Get details of a specific file.

```
GET /files/{file_id}
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "id": 1,
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_size": 1024000,
  "status": "indexed",
  "collection_id": 1,
  "metadata": {
    "pages": 10,
    "author": "John Doe"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

---

### Download File

Download the original file.

```
GET /files/{file_id}/download
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response

Returns the file with appropriate Content-Type header.

---

### Get File Content

Get extracted text content from a file.

```
GET /files/{file_id}/content
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "content": "Extracted text from the document...",
  "word_count": 1500
}
```

---

### Delete File

Delete a file and its associated data.

```
DELETE /files/{file_id}
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (204 No Content)

---

### Update File

Update file metadata.

```
PUT /files/{file_id}
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "filename": "new_filename.pdf",
  "collection_id": 2,
  "metadata": {
    "category": "important"
  }
}
```

#### Response (200 OK)

```json
{
  "id": 1,
  "filename": "new_filename.pdf",
  "updated_at": "2024-01-16T12:00:00Z"
}
```

---

## File Processing Status

| Status | Description |
|--------|-------------|
| pending | File uploaded, awaiting processing |
| processing | File is being processed |
| indexed | File processed and indexed |
| failed | Processing failed |
| deleted | File marked for deletion |

## Supported File Types

| Type | Extensions |
|------|------------|
| PDF | .pdf |
| Word | .doc, .docx |
| Text | .txt, .md |
| HTML | .html, .htm |
| CSV | .csv |
| JSON | .json |