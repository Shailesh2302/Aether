import { Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service.js';
import { AuthRequest } from './auth.js';

/**
 * authenticate() plus ?token= support for browser-initiated downloads
 * (<a download>, <img>, <iframe>) that cannot send Authorization headers.
 */
export const authenticateMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    if (!header?.startsWith('Bearer ') && !queryToken) {
      return res.status(401).json({ error: 'No token provided' });
    }
    try {
      const payload = authService.verifyToken(
        header?.startsWith('Bearer ') ? header.split(' ')[1] : (queryToken as string)
      );
      req.user = { userId: payload.userId, email: payload.email };
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
