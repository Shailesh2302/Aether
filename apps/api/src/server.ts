import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { config } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { logger } from './config/logger.js';

import authRoutes from './modules/auth/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import searchRoutes from './routes/search.routes.js';
import fileRoutes from './routes/file.routes.js';
import clipRoutes from './routes/clip.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'api', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/files/upload', uploadRoutes);
app.use('/api/clips', clipRoutes);
app.use('/api/users', userRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

async function startServer() {
  try {
    await connectDatabase();
    logger.info('Database connected');

    app.listen(config.port, () => {
      logger.info(`🚀 OmniMind API running on http://localhost:${config.port}`);
      logger.info(`📚 Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();