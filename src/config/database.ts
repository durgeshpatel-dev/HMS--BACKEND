import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;

// Configure PG pool - keep connections minimal for development
const pool = new Pool({
  connectionString,
  max: 5, // Smaller pool for development  
  min: 2, // Minimum connections
  idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
  connectionTimeoutMillis: 5000, // Fail fast if cannot connect
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],  // Only log errors in development
});

export default prisma;
