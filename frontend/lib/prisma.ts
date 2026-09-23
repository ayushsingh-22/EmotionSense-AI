import { PrismaClient } from '@prisma/client';

// Standard Next.js singleton pattern: cache the client on `globalThis` in
// development so hot-reloading doesn't spawn a new PrismaClient (and a new
// pool of DB connections) on every module reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
