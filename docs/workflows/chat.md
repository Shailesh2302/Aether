# Chat Workflow

## Overview

The chat workflow handles conversation management, context retrieval, and AI response generation.

## Workflow Diagram

```
┌─────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐
│  User   │───▶│  Message  │───▶│  Context   │───▶│ Generate │
│   Sends │    │  Received │    │  Retrieval │    │ Response │
└─────────┘    └───────────┘    └────────────┘    └──────────┘
                     │                                    │
                     ▼                                    ▼
              ┌──────────┐                         ┌──────────┐
              │  Store   │                         │ Stream   │
              │  Message │                         │ Response │
              └──────────┘                         └──────────┘
```

## Step-by-Step Process

### 1. Message Reception

**Endpoint**: `POST /api/v1/chat/conversations/{id}/messages`

```json
{
  "content": "What is the main topic of my documents?",
  "stream": true
}
```

**Validation**:
- Conversation exists
- User has access
- Rate limit check
- Content validation

### 2. Context Retrieval

Before generating a response, retrieve relevant context:

1. **Get conversation history** (last 10 messages)
2. **Vector search** in Qdrant
3. **Filter** by collection permissions

```python
def retrieve_context(query: str, collection_ids: list) -> list[str]:
    # Generate query embedding
    query_embedding = generate_embedding(query)

    # Search vector DB
    results = qdrant_client.search(
        collection_name="documents",
        query_vector=query_embedding,
        filter={"collection_id": {"in": collection_ids}},
        limit=5
    )

    # Return top chunks
    return [result.payload["text"] for result in results]
```

### 3. Prompt Construction

Build the LLM prompt:

```python
def build_prompt(user_message: str, context: list[str], history: list) -> str:
    system_prompt = """You are a helpful AI assistant.
    Use the following context to answer questions accurately.
    If the context doesn't contain relevant information, say so."""

    context_section = "\n\n".join([
        f"Context {i+1}: {ctx}"
        for i, ctx in enumerate(context)
    ])

    history_section = "\n".join([
        f"{msg.role}: {msg.content}"
        for msg in history[-10:]
    ])

    return f"{system_prompt}\n\n{context_section}\n\n{history_section}\n\nUser: {user_message}"
```

### 4. Response Generation

#### Non-Streaming

```python
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.7
)

assistant_message = response.choices[0].message.content
```

#### Streaming

```python
stream = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        yield chunk.choices[0].delta.content
```

### 5. Store Message

Save both user and assistant messages:

```sql
INSERT INTO messages (conversation_id, role, content)
VALUES (1, 'user', 'What is the main topic?');

INSERT INTO messages (conversation_id, role, content, token_count)
VALUES (1, 'assistant', 'Based on your documents...', 150);
```

### 6. Stream Response

Send response back to client:

```json
data: {"content": "Based", "done": false}
data: {"content": " on", "done": false}
data: {"content": " your", "done": false}
data: {"content": " documents", "done": false}
data: {"content": "...", "done": true}
```

## Conversation Management

### Creating a Conversation

```python
conversation = {
    "title": "Document Q&A",
    "user_id": 1,
    "model": "gpt-4",
    "collection_ids": [1, 2]
}
```

### Updating Context

Users can add/remove collections from a conversation:

```python
PUT /api/v1/chat/conversations/{id}
{
    "collection_ids": [1, 2, 3]
}
```

### Token Management

Track token usage per conversation:

```sql
CREATE TABLE conversation_tokens (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Rate Limiting

| Plan | Requests/Hour | Tokens/Day |
|------|---------------|------------|
| Free | 60 | 100,000 |
| Pro | 300 | 1,000,000 |
| Enterprise | Unlimited | Unlimited |

## Caching

Cache frequently asked questions:

```python
def get_cached_response(query: str) -> str | None:
    cache_key = hash(query)
    return redis.get(f"qa:{cache_key}")

def cache_response(query: str, response: str):
    cache_key = hash(query)
    redis.setex(f"qa:{cache_key}", 3600, response)
```

## Error Handling

| Error | Response |
|-------|----------|
| Rate limit exceeded | 429 with retry-after |
| Invalid conversation | 404 |
| LLM service down | 503 with fallback |
| Context too large | 400 with truncation |

## Monitoring

Track metrics:
- Response latency (p50, p95, p99)
- Token usage per user
- Conversation count
- Average message length