/**
 * CORS Configuration
 * Centralized CORS setup for Express and Socket.IO
 */

/**
 * Get allowed origins from environment variable
 */
export function getAllowedOrigins(): string | string[] {
    const frontendUrlEnv = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : '*');

    // In development, automatically allow standard localhost ports
    // This allows the app to work "out of the box" without configuring .env
    const devOrigins = [
        'http://localhost:5173', // Vite default
        'http://localhost:3000', // Backend default
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
    ];

    if (frontendUrlEnv === '*' || !frontendUrlEnv) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: CORS is allowing all origins in production! Set FRONTEND_URL.');
            // In production, we don't default to * if empty, we likely default to nothing or strict. 
            // But existing logic was *, so keeping compatible but warning.
            return '*';
        }
        return [...devOrigins, '*']; // Allow dev ports explicit + wildcard
    }

    const configured = frontendUrlEnv.split(',').map(url => url.trim());

    // Merge dev origins if not prod
    if (process.env.NODE_ENV !== 'production') {
        return [...new Set([...configured, ...devOrigins])];
    }

    return configured;
}

/**
 * Create CORS origin checker function for Express/Socket.IO
 */
export function getCorsOriginChecker() {
    const allowedOrigins = getAllowedOrigins();

    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // If wildcards are allowed (dev mode), just reflect true
        if (Array.isArray(allowedOrigins) && allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        if (allowedOrigins === '*') {
            return callback(null, true);
        }

        if (Array.isArray(allowedOrigins)) {
            // Check exact match
            if (allowedOrigins.includes(origin)) return callback(null, true);

            // Check with/without trailing slash
            const originNoSlash = origin.replace(/\/$/, '');
            const allowedNoSlash = allowedOrigins.map(o => o.replace(/\/$/, ''));

            if (allowedNoSlash.includes(originNoSlash)) return callback(null, true);

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
