# Chat API

## Overview

The Chat API provides endpoints for creating conversations, sending messages, and streaming AI responses.

## Base URL

```
https://api.aether.app/api/v1/chat
```

## Endpoints

### Create Conversation

Create a new chat conversation.

```
POST /conversations
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "title": "Document Q&A",
  "collection_ids": [1, 2],
  "model": "gpt-4"
}
```

#### Response (201 Created)

```json
{
  "id": 1,
  "title": "Document Q&A",
  "model": "gpt-4",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### List Conversations

Get all conversations for the user.

```
GET /conversations
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | Integer | Page number |
| limit | Integer | Items per page |
| search | String | Search by title |

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
      "title": "Document Q&A",
      "model": "gpt-4",
      "message_count": 10,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-16T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

### Get Conversation

Get a specific conversation with messages.

```
GET /conversations/{conversation_id}
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "id": 1,
  "title": "Document Q&A",
  "model": "gpt-4",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "What is this document about?",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "This document discusses...",
      "created_at": "2024-01-15T10:30:05Z"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T12:00:00Z"
}
```

---

### Send Message

Send a message and get a response.

```
POST /conversations/{conversation_id}/messages
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "content": "What is the main topic of the document?",
  "stream": false
}
```

#### Response (200 OK)

```json
{
  "id": 3,
  "role": "user",
  "content": "What is the main topic of the document?",
  "created_at": "2024-01-16T12:00:00Z"
}
```

#### Response (Streaming)

For streaming responses, use `stream: true`:

```
POST /conversations/{conversation_id}/messages
Content-Type: text/event-stream
```

```json
{
  "id": 4,
  "role": "user",
  "content": "Summarize the key points",
  "created_at": "2024-01-16T12:00:00Z"
}
```

Stream format:
```
data: {"content": "The", "done": false}
data: {"content": " document", "done": false}
data: {"content": " covers", "done": false}
data: {"content": "...", "done": true}
```

---

### Update Conversation

Update conversation settings.

```
PUT /conversations/{conversation_id}
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "title": "Updated Title",
  "model": "gpt-4",
  "collection_ids": [1]
}
```

#### Response (200 OK)

```json
{
  "id": 1,
  "title": "Updated Title",
  "model": "gpt-4",
  "updated_at": "2024-01-16T14:00:00Z"
}
```

---

### Delete Conversation

Delete a conversation and all its messages.

```
DELETE /conversations/{conversation_id}
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (204 No Content)

---

### Search in Conversation

Search for messages within a conversation.

```
GET /conversations/{conversation_id}/search
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| q | String | Search query |

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "results": [
    {
      "message_id": 5,
      "content": "matching message content",
      "score": 0.95
    }
  ]
}
```

---

## WebSocket API

For real-time chat, connect to the WebSocket endpoint:

```
wss://api.aether.app/api/v1/chat/ws
```

### Authentication

```
wss://api.aether.app/api/v1/chat/ws?token=<access_token>
```

### Message Format

Send:
```json
{
  "type": "message",
  "conversation_id": 1,
  "content": "Hello, how can you help me?"
}
```

Receive:
```json
{
  "type": "message",
  "id": 6,
  "content": "Hello! I can help you with...",
  "done": false
}
```

---

## Error Responses

| Code | Description |
|------|-------------|
| 400 | Invalid request format |
| 404 | Conversation not found |
| 429 | Rate limit exceeded |
| 503 | AI service unavailable |