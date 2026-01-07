/**
 * Register Page Component
 * Handles new user registration with email verification
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './AuthPages.css';

interface RegisterPageProps {
    onSwitchToLogin: () => void;
    onSuccess?: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin, onSuccess }) => {
    const { register, loginWithGoogle } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    const validateForm = (): string | null => {
        if (name.trim().length < 2) {
            return 'Name must be at least 2 characters';
        }
        if (password.length < 8) {
            return 'Password must be at least 8 characters';
        }
        if (password !== confirmPassword) {
            return 'Passwords do not match';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);

        const result = await register(email, password, name);

        setIsLoading(false);

        if (result.success) {
            setRegistrationSuccess(true);
            onSuccess?.();
        } else {
            setError(result.error || 'Registration failed');
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
        } catch (err) {
            setError('Google sign-up failed. Please try again.');
        }
    };

    // Show success message after registration
    if (registrationSuccess) {
        return (
            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-success">
                        <div className="success-icon">✉️</div>
                        <h2>Check Your Email</h2>
                        <p>
                            We've sent a verification link to <strong>{email}</strong>.
                            <br />
                            Please click the link to verify your account.
                        </p>
                        <div className="success-tips">
                            <p>💡 Didn't receive the email?</p>
                            <ul>
                                <li>Check your spam folder</li>
                                <li>Make sure you entered the correct email</li>
                                <li>Wait a few minutes and try again</li>
                            </ul>
                        </div>
                        <button
                            type="button"
                            className="auth-button secondary"
                            onClick={onSwitchToLogin}
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <div className="auth-logo">
                        <span className="logo-icon">💆</span>
                        <span className="logo-text">Serenity Wellness</span>
                    </div>
                    <h1>Create Account</h1>
                    <p>Join us for a relaxing experience</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            required
                            autoComplete="name"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="password-input">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                minLength={8}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                        <span className="input-hint">At least 8 characters</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-button primary"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            'Create Account'
                        )}
                    </button>

                    <div className="auth-divider">
                        <span>or continue with</span>
                    </div>

                    <button
                        type="button"
                        className="auth-button google"
                        onClick={handleGoogleLogin}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    <p className="auth-terms">
                        By creating an account, you agree to our{' '}
                        <a href="#/terms">Terms of Service</a> and{' '}
                        <a href="#/privacy">Privacy Policy</a>
                    </p>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account?{' '}
                        <button type="button" onClick={onSwitchToLogin}>
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
