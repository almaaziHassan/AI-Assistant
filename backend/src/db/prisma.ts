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

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

export default prisma;
