import { PrismaClient } from '@prisma/client';

/**
 * Prisma client configuration for MCP server
 * Supports both production API mode and local database mode
 */

// Environment-based configuration
const isProductionMode = !!process.env.NEEMEE_API_BASE_URL;
const databaseUrl = process.env.DATABASE_URL || 'postgresql://neemee_user:local_dev_password@localhost:5433/neemee';

// Global variable to store the Prisma Client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma Client instance
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  errorFormat: 'minimal',
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

// In development, store the instance globally to prevent hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  await prisma.$disconnect();
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

export default prisma;