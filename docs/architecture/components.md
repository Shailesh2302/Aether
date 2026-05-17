# Component Details

## Frontend Service

### Technology
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **API Client**: React Query + Axios

### Responsibilities
- User interface rendering
- Authentication flow
- Real-time updates
- File upload handling

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/documents` | List documents |
| POST | `/api/documents` | Upload document |

## Backend Service

### Technology
- **Framework**: FastAPI (Python) / Actix-web (Rust)
- **Language**: Python 3.11 / Rust 1.75
- **ORM**: SQLAlchemy / Diesel

### Responsibilities
- Business logic
- Authentication
- File processing
- Vector indexing

### Core Modules

#### Authentication Module
```
- Login/Register
- JWT token management
- Session handling
- Password hashing (bcrypt)
```

#### Document Module
```
- File upload/download
- Text extraction
- Metadata indexing
- Versioning
```

#### Chat Module
```
- Conversation management
- Message persistence
- Context handling
- Streaming responses
```

#### Search Module
```
- Vector search (Qdrant)
- Full-text search
- Hybrid search
- Result ranking
```

## Database Components

### PostgreSQL Schema

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Documents Table
```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES collections(id),
    title VARCHAR(500) NOT NULL,
    content TEXT,
    file_path VARCHAR(1000),
    file_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Collections Table
```sql
CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Messages Table
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Redis Usage
- Session storage
- API response caching
- Rate limiting counters
- Pub/sub for real-time updates

### Qdrant Collections
| Collection | Dimensions | Metric |
|------------|------------|--------|
| document_embeddings | 1536 | Cosine |
| chat_embeddings | 1536 | Cosine |

## Service Communication

### Internal API
- gRPC for service-to-service
- JSON REST for external access
- WebSocket for real-time

### Message Queue (Optional)
- RabbitMQ for async tasks
- Background job processing

## Infrastructure Components

### Nginx Configuration
- Load balancing
- SSL termination
- Static file serving
- WebSocket proxy

### Monitoring Stack
- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **Loki**: Log aggregation
- **Alertmanager**: Alert routing