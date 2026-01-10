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
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (Array.isArray(allowedOrigins)) {
            // Check exact match
            if (allowedOrigins.includes(origin)) return callback(null, true);

            // Check with/without trailing slash
            const originNoSlash = origin.replace(/\/$/, '');
            const allowedNoSlash = allowedOrigins.map(o => o.replace(/\/$/, ''));

            if (allowedNoSlash.includes(originNoSlash)) return callback(null, true);

            // Check for Vercel preview deployments
            // Pattern: https://ai-assistant-v7-.*-tellyquests-projects.vercel.app
            const vercelPreviewRegex = /^https:\/\/ai-assistant-v7-.*-tellyquests-projects\.vercel\.app$/;
            if (vercelPreviewRegex.test(originNoSlash)) {
                return callback(null, true);
            }

            console.error(`CORS Blocked Origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
        }

        callback(new Error('Not allowed by CORS'));
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
 * Socket.IO needs special handling - use true for all origins, not '*'
 */
export function getSocketCorsConfig() {
    const allowedOrigins = getAllowedOrigins();

    // For Socket.IO, use true to allow all origins (not the string '*')
    if (allowedOrigins === '*') {
        return {
            origin: true,
            methods: ['GET', 'POST'],
            credentials: true
        };
    }

    return {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    };
}
