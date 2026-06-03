import { PrismaClient } from '@prisma/client';
import { config } from './env.js';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!process.env.POSTGRES_URL) {
  logger.fatal('POSTGRES_URL is not set in the environment');
  process.exit(1);
}

const redactedUrl = process.env.POSTGRES_URL.replace(/:[^:@/]+@/, ':***@');
logger.info({ url: redactedUrl }, 'Initializing Prisma client');

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}