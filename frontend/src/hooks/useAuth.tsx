/**
 * User Authentication Context
 * Manages user authentication state across the application
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// User type
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
}

// Auth context type
interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved auth state on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            // Verify token is still valid
            verifyToken(savedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    // Verify token with server
    const verifyToken = async (authToken: string) => {
        try {
            const response = await fetch(`${API_URL}/api/user-auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                // Token invalid, clear auth state
                logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Login with email and password
    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/api/user-auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem(TOKEN_KEY, data.token);
                localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    };

    // Login with Google OAuth
    const loginWithGoogle = async () => {
        // Open Google OAuth window
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            `${API_URL}/api/user-auth/google`,
            'Google Login',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Check if popup was blocked
        if (!popup || popup.closed) {
            // Fallback: redirect in same window
            window.location.href = `${API_URL}/api/user-auth/google`;
            return;
        }

        // Listen for OAuth callback message
        const handleMessage = (event: MessageEvent) => {
            // Check for oauth-success message (origin varies between local/production)
            if (event.data && event.data.type === 'oauth-success') {
                const { token: authToken, user: authUser } = event.data;
                if (authToken && authUser) {
                    setToken(authToken);
                    setUser(authUser);
                    localStorage.setItem(TOKEN_KEY, authToken);
                    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
                    popup?.close();
                    window.removeEventListener('message', handleMessage);
                    // Reload to update chat with user session
                    window.location.reload();
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener when popup closes
        const checkClosed = setInterval(() => {
            if (popup?.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
            }
        }, 500);
    };

    // Register new user
    const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/api/user-auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Registration failed' };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    };

    // Logout
    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    };

    // Update user data
    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    };

    const value: AuthContextType = {
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        loginWithGoogle,
        register,
        logout,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom hook to use auth context
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
