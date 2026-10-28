import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/environment.js';

// Reuse a single client across hot-reloads / multiple imports.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (!isProduction()) {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
