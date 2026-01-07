/**
 * Auth Modal Component
 * Modal wrapper for login/register/forgot password flows
 */

import React, { useState } from 'react';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import './AuthModal.css';

type AuthView = 'login' | 'register' | 'forgot-password';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialView?: AuthView;
    onSuccess?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialView = 'login',
    onSuccess
}) => {
    const [view, setView] = useState<AuthView>(initialView);

    if (!isOpen) return null;

    const handleSuccess = () => {
        onSuccess?.();
        onClose();
    };

    const renderContent = () => {
        switch (view) {
            case 'register':
                return (
                    <RegisterPage
                        onSwitchToLogin={() => setView('login')}
                        onSuccess={handleSuccess}
                    />
                );
            case 'forgot-password':
                return (
                    <ForgotPasswordPage
                        onBackToLogin={() => setView('login')}
                    />
                );
            default:
                return (
                    <LoginPage
                        onSwitchToRegister={() => setView('register')}
                        onForgotPassword={() => setView('forgot-password')}
                        onSuccess={handleSuccess}
                    />
                );
        }
    };

    return (
        <div className="auth-modal-overlay" onClick={onClose}>
            <div className="auth-modal-content" onClick={e => e.stopPropagation()}>
                <button className="auth-modal-close" onClick={onClose}>
                    ✕
                </button>
                {renderContent()}
            </div>
        </div>
    );
};

export default AuthModal;
