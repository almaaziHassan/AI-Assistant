/**
 * Prisma Client Singleton for Supabase PostgreSQL
 * 
 * Prisma 7 requires an adapter for PostgreSQL connections.
 * This file sets up the pg adapter with the correct configuration.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create connection pool
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

// Create pg Pool with SSL for Supabase
const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Required for Supabase
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Prevent multiple instances of Prisma Client in development
declare global {
    var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

export default prisma;
