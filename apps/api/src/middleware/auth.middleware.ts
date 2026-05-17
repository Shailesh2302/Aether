import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    logger.error({ error }, 'Auth middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
    };
    req.user = decoded;
  } catch {
    // Ignore invalid tokens for optional auth
  }
  
  next();
}