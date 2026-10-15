import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import {
  PLANS,
  TRIAL_DAYS,
  PlanId,
  getAccessState,
  createCheckoutSession,
  cancelSubscription,
  handleStripeWebhook,
  isPaymentsConfigured,
} from './subscription.service.js';
import { logger } from '../../config/logger.js';

const router = Router();

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/** Public: list plans + trial info (powers the pricing page). */
router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    trialDays: TRIAL_DAYS,
    currency: 'usd',
    paymentsConfigured: isPaymentsConfigured(),
    plans: (Object.keys(PLANS) as PlanId[]).map((id) => ({
      id,
      ...PLANS[id],
      priceDollars: PLANS[id].priceCents / 100,
    })),
  });
});

/** Current user's trial / subscription state. */
router.get('/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const state = await getAccessState(req.user!.userId);
    res.json({ ...state, trialDays: TRIAL_DAYS, paymentsConfigured: isPaymentsConfigured() });
  } catch (error) {
    next(error);
  }
});

/** Create a Stripe Checkout session for a plan. */
router.post(
  '/checkout',
  authenticate,
  [body('plan').isIn(Object.keys(PLANS)).withMessage('Invalid plan')],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!isPaymentsConfigured()) {
        return res.status(503).json({ error: 'Payments are not configured yet. Please contact support.' });
      }
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const result = await createCheckoutSession(
        req.user!.userId,
        req.user!.email,
        req.body.plan as PlanId,
        appUrl
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Cancel at period end (keeps access until expiry). */
router.post('/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await cancelSubscription(req.user!.userId);
    res.json({ success: true, cancelAtPeriodEnd: sub.cancelAtPeriodEnd });
  } catch (error) {
    next(error);
  }
});

/**
 * Stripe webhook. Mounted with express.raw() in server.ts so `req.body`
 * is the raw Buffer Stripe's signature verification requires.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.header('stripe-signature') || '';
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  try {
    const result = await handleStripeWebhook(req.body as Buffer, signature);
    res.json(result);
  } catch (error) {
    logger.error({ error }, 'Stripe webhook failed');
    return res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
