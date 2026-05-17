import { PrismaClient } from '@prisma/client';
import { config } from './env.js';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

prisma.$on('error', (e) => {
  logger.error(e, 'Prisma Error');
});

prisma.$on('query', (e) => {
  logger.debug({ query: e.query, duration: e.duration }, 'Prisma Query');
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}