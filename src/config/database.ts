import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import './env';

const connectionString = process.env.DATABASE_URL!;

// Configure PG pool
// max must be large enough to handle concurrent interactive transactions
// (each Prisma $transaction holds one connection for its duration).
const pool = new Pool({
  connectionString,
  max: 15, // Must exceed max concurrent $transactions to avoid deadlocks
  min: 2,
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Fail after 10s if no connection available
  statement_timeout: 30000, // Kill any query running longer than 30s
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// NOTE: Prisma adapter and root pg typings can differ across environments.
// Cast keeps runtime behavior identical while avoiding TS type-package mismatch.
const adapter = new PrismaPg(pool as any);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],  // Only log errors in development
});

// Log warning when pool is nearly exhausted (helps diagnose hangs)
setInterval(() => {
  const waiting = pool.waitingCount;
  const idle = pool.idleCount;
  const total = pool.totalCount;
  if (waiting > 0) {
    console.warn(`⚠️  DB Pool pressure: ${total} total, ${idle} idle, ${waiting} waiting`);
  }
}, 5000);

export { pool };
export default prisma;
