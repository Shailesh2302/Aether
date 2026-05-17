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
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333', 10),
  },
  
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3002',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRY || '7d',
  },
  
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    uploadDir: process.env.UPLOAD_DIR || './storage/uploads',
    clipsDir: process.env.CLIPS_DIR || './storage/clips',
  },
};