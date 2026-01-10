/**
 * Prisma Client Singleton for Supabase PostgreSQL
 * 
 * Prisma 6 - Simpler setup without adapters
 */

import dotenv from 'dotenv';
dotenv.config(); // Load env vars before accessing DATABASE_URL

import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

// Prevent multiple instances of Prisma Client in development
declare global {
    var prisma: PrismaClient | undefined;
}

const getDatabaseUrl = () => {
    let url = process.env.DATABASE_URL;
    if (!url) return undefined;

    // Supabase Pooler Fix: Port 6543 requires pgbouncer mode for Prisma
    if (url.includes('pooler.supabase.com') && url.includes(':6543')) {
        if (!url.includes('pgbouncer=true')) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}pgbouncer=true`;
            console.log('🔧 Auto-fixing Supabase pooler connection string: Added pgbouncer=true');
        }
    }
    return url;
};

const prisma = global.prisma || new PrismaClient({
    datasources: {
        db: {
            url: getDatabaseUrl()
        }
    },
    // Add logs for better debugging
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

export default prisma;
