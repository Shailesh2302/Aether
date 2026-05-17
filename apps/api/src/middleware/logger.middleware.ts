import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';

export const requestLogger = morgan(
  config.log.format === 'json' ? 'json' : 'combined',
  {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
    skip: (_req, res) => res.statusCode < 400,
  }
);

export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  req.headers['x-request-id'] = req.headers['x-request-id'] || 
    `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  next();
}