import { useState, useEffect } from 'react';

const AUTH_TOKEN_KEY = 'admin_auth_token';

interface UseAdminAuthReturn {
    isAuthenticated: boolean;
    authLoading: boolean;
    loginError: string | null;
    password: string;
    setPassword: (password: string) => void;
    handleLogin: (e: React.FormEvent) => Promise<void>;
    handleLogout: () => Promise<void>;
    getAuthHeaders: () => HeadersInit;
}

export function useAdminAuth(serverUrl: string): UseAdminAuthReturn {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [password, setPassword] = useState('');

    // Get stored auth token
    const getAuthToken = (): string | null => {
        try {
            return localStorage.getItem(AUTH_TOKEN_KEY);
        } catch {
            return null;
        }
    };

    // Store auth token
    const setAuthToken = (token: string): void => {
        try {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        } catch {
            // Ignore storage errors
        }
    };

    // Remove auth token
    const removeAuthToken = (): void => {
        try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {
            // Ignore storage errors
        }
    };

    // Create fetch headers with auth token
    const getAuthHeaders = (): HeadersInit => {
        const token = getAuthToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    };

    // Verify existing session on mount
    useEffect(() => {
        const verifySession = async () => {
            const token = getAuthToken();
            if (!token) {
                setAuthLoading(false);
                return;
            }

            try {
                const res = await fetch(`${serverUrl}/api/auth/verify`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setIsAuthenticated(data.valid);
                if (!data.valid) {
                    removeAuthToken();
                }
            } catch {
                setIsAuthenticated(false);
                removeAuthToken();
            } finally {
                setAuthLoading(false);
            }
        };

        verifySession();
    }, [serverUrl]);

    // Handle login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);

        try {
            const res = await fetch(`${serverUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (res.ok && data.token) {
                setAuthToken(data.token);
                setIsAuthenticated(true);
                setPassword('');
            } else {
                setLoginError(data.error || 'Login failed');
            }
        } catch (err: any) {
            console.error('Login Error:', err);
            console.log('Attempted Server URL:', serverUrl);
            setLoginError(`Connection error: ${err.message} (URL: ${serverUrl})`);
        }
    };

    // Handle logout
    const handleLogout = async () => {
        const token = getAuthToken();
        if (token) {
            try {
                await fetch(`${serverUrl}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch {
                // Ignore logout errors
            }
        }
        removeAuthToken();
        setIsAuthenticated(false);
    };

    return {
        isAuthenticated,
        authLoading,
        loginError,
        password,
        setPassword,
        handleLogin,
        handleLogout,
        getAuthHeaders
    };
}
