import Stripe from 'stripe';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';

export const TRIAL_DAYS = 30;

export const PLANS = {
  PLAN_3_MONTH: { months: 3, priceCents: 1000, label: '3-Month Plan', tagline: 'Perfect for trying things out' },
  PLAN_6_MONTH: { months: 6, priceCents: 1500, label: '6-Month Plan', tagline: 'Our most popular choice' },
  PLAN_12_MONTH: { months: 12, priceCents: 2000, label: '12-Month Plan', tagline: 'Best value for power users' },
} as const;

export type PlanId = keyof typeof PLANS;

const ACTIVE_STATUSES = ['TRIALING', 'ACTIVE'] as const;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function isPaymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface AccessState {
  access: 'trial' | 'active' | 'expired';
  status: string;
  plan: string;
  trialDaysLeft: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Ensure the user has a subscription row (trial starts at account creation). */
export async function getOrCreateSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  const trialEndsAt = new Date((user?.createdAt ?? new Date()).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  return prisma.subscription.create({
    data: { userId, plan: 'TRIAL', status: 'TRIALING', trialEndsAt },
  });
}

/** Lazily expire stale trials / periods, then report access state. */
export async function getAccessState(userId: string): Promise<AccessState> {
  // Neon round-trips dominate API latency (~0.5s each), and access state
  // changes rarely - cache briefly per user. Writes (activate/cancel/
  // webhook) invalidate via touchAccessCache().
  const now = new Date();
  const cached = accessCache.get(userId);
  if (cached && cached.expiresAt > now.getTime()) {
    return cached.state;
  }

  const sub = await getOrCreateSubscription(userId);

  let status = sub.status;
  if (status === 'TRIALING' && sub.trialEndsAt <= now) {
    status = 'EXPIRED';
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED', plan: 'TRIAL' } });
    logger.info({ userId }, 'Trial expired');
  } else if (status === 'ACTIVE' && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
    status = 'EXPIRED';
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
    logger.info({ userId }, 'Paid period ended');
  }

  const trialDaysLeft = status === 'TRIALING'
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;

  const state: AccessState = {
    access: status === 'EXPIRED' || status === 'CANCELED' || status === 'PAST_DUE' ? 'expired' : status === 'TRIALING' ? 'trial' : 'active',
    status,
    plan: sub.plan,
    trialDaysLeft,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
  accessCache.set(userId, { state, expiresAt: now.getTime() + ACCESS_CACHE_TTL_MS });
  return state;
}

// Short-lived access cache (see getAccessState). Invalidated on writes.
const ACCESS_CACHE_TTL_MS = 60_000;
const accessCache = new Map<string, { state: AccessState; expiresAt: number }>();

export function touchAccessCache(userId: string): void {
  accessCache.delete(userId);
}

export async function hasAccess(userId: string): Promise<boolean> {
  const state = await getAccessState(userId);
  return state.access !== 'expired';
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function createCheckoutSession(userId: string, email: string, plan: PlanId, appUrl: string) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Payments are not configured on this server (STRIPE_SECRET_KEY missing)');
  }
  const meta = PLANS[plan];
  const sub = await getOrCreateSubscription(userId);

  let customerId = sub.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
    await prisma.subscription.update({ where: { id: sub.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: meta.priceCents,
          product_data: { name: `Aether ${meta.label}` },
          recurring: { interval: 'month', interval_count: meta.months },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
    success_url: `${appUrl}/dashboard/billing?success=1&plan=${plan}`,
    cancel_url: `${appUrl}/pricing?canceled=1`,
  });

  return { url: session.url, sessionId: session.id };
}

export async function cancelSubscription(userId: string) {
  const sub = await getOrCreateSubscription(userId);
  const stripe = getStripe();

  if (stripe && sub.stripeSubscriptionId) {
    try {
      // Cancel at period end so the user keeps access already paid for.
      await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    } catch (err) {
      logger.warn({ err, userId }, 'Stripe cancel-at-period-end failed, marking locally');
    }
  }

  return prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true },
  }).then((updated) => {
    touchAccessCache(userId);
    return updated;
  });
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    throw new Error('Stripe webhook is not configured');
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as PlanId | undefined;
      if (userId && plan && PLANS[plan]) {
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
        await activatePaidSubscription(userId, plan, stripeSub);
        logger.info({ userId, plan }, 'Subscription activated via checkout');
      }
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
      const subRef = invoice.subscription;
      const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id;
      if (subscriptionId) {
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = stripeSub.metadata?.userId;
        const plan = stripeSub.metadata?.plan as PlanId | undefined;
        if (userId && plan && PLANS[plan]) {
          await activatePaidSubscription(userId, plan, stripeSub);
        }
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
      const subRef = invoice.subscription;
      const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id;
      if (subscriptionId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'PAST_DUE' },
        });
        const affected = await prisma.subscription.findMany({
          where: { stripeSubscriptionId: subscriptionId },
          select: { userId: true },
        });
        affected.forEach((a) => touchAccessCache(a.userId));
        logger.warn({ subscriptionId }, 'Payment failed, marked PAST_DUE');
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSub.id },
        data: { status: 'EXPIRED', cancelAtPeriodEnd: false },
      });
      const affected = await prisma.subscription.findMany({
        where: { stripeSubscriptionId: stripeSub.id },
        select: { userId: true },
      });
      affected.forEach((a) => touchAccessCache(a.userId));
      logger.info({ subscriptionId: stripeSub.id }, 'Subscription deleted, marked EXPIRED');
      break;
    }
    default:
      logger.info({ type: event.type }, 'Unhandled Stripe event');
  }

  return { received: true };
}

async function activatePaidSubscription(userId: string, plan: PlanId, stripeSub: Stripe.Subscription & { current_period_end?: number }) {
  const now = new Date();
  // Stripe's period may be shorter than our multi-month plans on edge cases;
  // guarantee at least the purchased months from activation/renewal.
  const guaranteedEnd = addMonths(now, PLANS[plan].months);
  const stripeEnd = stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null;
  const currentPeriodEnd = stripeEnd && stripeEnd > guaranteedEnd ? stripeEnd : guaranteedEnd;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: 'ACTIVE',
      trialEndsAt: now,
      currentPeriodStart: now,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
      stripeSubscriptionId: stripeSub.id,
    },
    update: {
      plan,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      stripeSubscriptionId: stripeSub.id,
    },
  });
  touchAccessCache(userId);
}

export { ACTIVE_STATUSES };
