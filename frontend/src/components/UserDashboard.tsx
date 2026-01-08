/**
 * User Dashboard Page
 * Main page users see after login with:
 * - Auto-opening chat widget
 * - Two tabs: My Appointments and My Account
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '../hooks/useAuth';
import ChatWidget from './ChatWidget';
import './UserDashboard.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Lazy load tab content
const AppointmentsTab = lazy(() => import('./AppointmentsTab'));
const AccountTab = lazy(() => import('./AccountTab'));

interface UserDashboardProps {
    serverUrl?: string;
    onLogout?: () => void;
}

const LoadingSpinner = () => (
    <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
    </div>
);

const UserDashboard: React.FC<UserDashboardProps> = ({
    serverUrl = API_URL,
    onLogout
}) => {
    const { user, logout, isAuthenticated } = useAuth();
    const [activeTab, setActiveTab] = useState<'appointments' | 'account'>('appointments');
    const [chatOpen, setChatOpen] = useState(true); // Auto-open chat on load

    // Redirect to home if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            window.location.hash = '';
        }
    }, [isAuthenticated]);

    const handleLogout = () => {
        logout();
        onLogout?.();
        window.location.hash = '';
    };

    const goToHome = () => {
        window.location.hash = '';
    };

    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <div className="user-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="dashboard-header-content">
                    <button className="back-button" onClick={goToHome}>
                        <span className="back-icon">←</span>
                        <span className="brand-name">Luxe Spa & Wellness</span>
                    </button>

                    <div className="header-right">
                        <div className="user-info">
                            <span className="user-greeting">Hello, </span>
                            <span className="user-name">{user.firstName || user.email.split('@')[0]}</span>
                        </div>
                        <button className="logout-button" onClick={handleLogout}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-main">
                {/* Welcome Section */}
                <section className="welcome-section">
                    <h1 className="welcome-title">Welcome back! 👋</h1>
                    <p className="welcome-subtitle">
                        Manage your appointments and account settings below.
                    </p>
                </section>

                {/* Tabs Navigation */}
                <div className="tabs-container">
                    <div className="tabs-nav">
                        <button
                            className={`tab-button ${activeTab === 'appointments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('appointments')}
                        >
                            <span className="tab-icon">📅</span>
                            <span className="tab-label">My Appointments</span>
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            <span className="tab-icon">👤</span>
                            <span className="tab-label">My Account</span>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="tab-content">
                        <Suspense fallback={<LoadingSpinner />}>
                            {activeTab === 'appointments' && <AppointmentsTab serverUrl={serverUrl} />}
                            {activeTab === 'account' && <AccountTab />}
                        </Suspense>
                    </div>
                </div>
            </main>

            {/* Chat Widget - Auto-opens for user */}
            <ChatWidget
                serverUrl={serverUrl}
                defaultOpen={chatOpen}
                onClose={() => setChatOpen(false)}
            />

            {/* Quick Action Button to Open Chat */}
            {!chatOpen && (
                <button
                    className="open-chat-fab"
                    onClick={() => setChatOpen(true)}
                    aria-label="Open chat"
                >
                    💬 Need Help?
                </button>
            )}
        </div>
    );
};

export default UserDashboard;
