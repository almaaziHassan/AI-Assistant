/**
 * CORS Configuration
 * Centralized CORS setup for Express and Socket.IO
 */

/**
 * Get allowed origins from environment variable
 */
export function getAllowedOrigins(): string | string[] {
    const frontendUrlEnv = process.env.FRONTEND_URL || '*';

    if (frontendUrlEnv === '*') {
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: CORS is allowing all origins in production! Set FRONTEND_URL.');
        }
        return '*';
    }

    return frontendUrlEnv.split(',').map(url => url.trim());
}

/**
 * Create CORS origin checker function for Express/Socket.IO
 */
export function getCorsOriginChecker() {
    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins === '*') {
        return '*';
    }

    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    };
}

/**
 * Get CORS configuration for Express
 */
export function getExpressCorsConfig() {
    return {
        origin: getCorsOriginChecker(),
        credentials: true
    };
}

/**
 * Get CORS configuration for Socket.IO
 */
export function getSocketCorsConfig() {
    return {
        origin: getCorsOriginChecker(),
        methods: ['GET', 'POST'],
        credentials: true
    };
}
