import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'omnimind',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    url: process.env.POSTGRES_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  qdrant: {
    host: process.env.QDRANT_HOST || '2e308c4b-9092-44ce-b8fd-206f1fc3294e.sa-east-1-0.aws.cloud.qdrant.io',
    port: parseInt(process.env.QDRANT_PORT || '6333', 10),
    grpcPort: parseInt(process.env.QDRANT_GRPC_PORT || '6334', 10),
    apiKey: process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6M2ZkYzE1YzYtNGYwMC00ODRhLWIxNGEtMDhkMGZiOWQxN2UwIn0.lwb1EbZvxlS2rkZcTj0W5bYpW7YC7-5bMZUghjVsjj0',
  },

  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3002',

  ai: {
    apiKey: process.env.NVIDIA_API_KEY || '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',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRY || '7d',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    uploadDir: process.env.UPLOAD_DIR || './storage/uploads',
    clipsDir: process.env.CLIPS_DIR || './storage/clips',
    apiUrl: process.env.STORAGE_API_URL || 'http://localhost:3001',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10),
    endpoint: process.env.STORAGE_UPLOAD_ENDPOINT || '/api/files/upload',
  },
};