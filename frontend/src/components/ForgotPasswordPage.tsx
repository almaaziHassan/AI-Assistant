/**
 * Forgot Password Page Component
 * Handles password reset request
 */

import React, { useState } from 'react';
import './AuthPages.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

interface ForgotPasswordPageProps {
    onBackToLogin: () => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/user-auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setEmailSent(true);
            } else {
                setError(data.error || 'Failed to send reset email');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Show success message after email sent
    if (emailSent) {
        return (
            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-success">
                        <div className="success-icon">📧</div>
                        <h2>Check Your Email</h2>
                        <p>
                            If an account exists with <strong>{email}</strong>, you'll receive a password reset link shortly.
                        </p>
                        <div className="success-tips">
                            <p>💡 The link will expire in 1 hour</p>
                        </div>
                        <button
                            type="button"
                            className="auth-button secondary"
                            onClick={onBackToLogin}
                        >
                            Back to Login
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
                        <span className="logo-icon">🔐</span>
                    </div>
                    <h1>Reset Password</h1>
                    <p>Enter your email to receive a reset link</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}

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

                    <button
                        type="submit"
                        className="auth-button primary"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            'Send Reset Link'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Remember your password?{' '}
                        <button type="button" onClick={onBackToLogin}>
                            Back to Login
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
