import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { getAccessState } from '../modules/subscription/subscription.service.js';

/**
 * Blocks paid endpoints when the 30-day trial has ended and there is no
 * active subscription. Responds 402 with an upgrade hint the web UI
 * turns into a paywall prompt.
 */
export const requireSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const state = await getAccessState(req.user.userId);
    if (state.access === 'expired') {
      return res.status(402).json({
        error: 'Your free trial has ended. Please subscribe to continue.',
        code: 'SUBSCRIPTION_REQUIRED',
        status: state.status,
        plan: state.plan,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
