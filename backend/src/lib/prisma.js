import { PrismaClient } from '@prisma/client';

// Reuse a single client across hot-reloads / multiple imports.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
