# Aether

<p align="center">
  <img src="https://via.placeholder.com/150/4F46E5/ffffff?text=Aether" alt="Aether Logo" />
</p>

An AI-powered knowledge management system with vector search, conversational AI, and document processing capabilities.

## Features

- **Document Management**: Upload, process, and index documents for semantic search
- **Vector Search**: Powered by Qdrant for similarity search
- **Conversational AI**: Chat with your documents using LLMs
- **Real-time Updates**: WebSocket support for live chat
- **RESTful API**: Full REST API for integrations
- **Monitoring**: Prometheus + Grafana for observability

## Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- 4GB RAM minimum

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aether/aether.git
cd aether
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Start services:
```bash
cd infrastructure/scripts
./setup.sh
```

4. Access the application:
- Frontend: http://localhost
- API: http://localhost/api
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Default Credentials

```
Admin: admin@aether.app / admin123
Demo: demo@aether.app / demo123
```

## Architecture

```
Client Layer (Web/Mobile)
         │
    Nginx Load Balancer
         │
  ┌──────┴──────┐
  │             │
Frontend     Backend API
              (Rust/Python)
         │
  ┌─────┴─────┬──────┐
  │           │      │
PostgreSQL  Redis  Qdrant
            (Cache) (Vectors)
```

## Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [Component Details](docs/architecture/components.md)
- [API Reference](docs/api/)
- [Workflows](docs/workflows/)

## API Usage

### Authentication

```bash
# Login
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@aether.app", "password": "admin123"}'
```

### Upload Document

```bash
curl -X POST http://localhost/api/v1/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@document.pdf"
```

### Chat

```bash
# Create conversation
curl -X POST http://localhost/api/v1/chat/conversations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Chat"}'

# Send message
curl -X POST http://localhost/api/v1/chat/conversations/1/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!"}'
```

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
pytest

# Frontend tests
npm test

# Full test suite
docker-compose -f docker-compose.test.yml up
```

## Deployment

### Production

```bash
cd infrastructure/scripts
./deploy.sh production
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    image: aether/backend:latest
    ports:
      - "8000:8000"
  frontend:
    image: aether/frontend:latest
    ports:
      - "3000:3000"
  postgres:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
  qdrant:
    image: qdrant/qdrant:v1.7.4
```

## Monitoring

### Prometheus Metrics

Access metrics at: `http://localhost:9090`

Key metrics:
- `http_requests_total` - Request count
- `http_request_duration_seconds` - Response time
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage

### Grafana Dashboards

Access dashboards at: `http://localhost:3001`

- System Overview
- Database Metrics
- API Performance

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | postgres://aether:aether@postgres:5432/aether |
| `REDIS_URL` | Redis connection | redis://redis:6379 |
| `QDRANT_URL` | Qdrant URL | http://qdrant:6333 |
| `JWT_SECRET` | JWT signing secret | change-me |
| `OPENAI_API_KEY` | OpenAI API key | - |

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Documentation: https://docs.aether.app
- Issues: https://github.com/aether/aether/issues
- Discord: https://discord.gg/aether