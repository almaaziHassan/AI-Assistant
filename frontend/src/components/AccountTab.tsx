/**
 * Account Tab Component
 * User profile management
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const AccountTab: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Password change
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/api/user-auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ firstName, lastName, phone })
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                refreshUser?.();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 8) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
            return;
        }

        setPasswordSaving(true);
        setPasswordMessage(null);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/api/user-auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (data.success) {
                setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowPasswordForm(false);
            } else {
                setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
            }
        } catch (err) {
            setPasswordMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div className="account-tab">
            {/* Profile Section */}
            <section className="account-section">
                <h2 className="section-title">
                    <span className="section-icon">👤</span>
                    Personal Information
                </h2>

                <form onSubmit={handleSaveProfile} className="profile-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Your first name"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                id="lastName"
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Your last name"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="disabled-input"
                        />
                        <span className="input-hint">Email cannot be changed</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Phone Number</label>
                        <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                        />
                    </div>

                    {message && (
                        <div className={`form-message ${message.type}`}>
                            {message.type === 'success' ? '✅' : '❌'} {message.text}
                        </div>
                    )}

                    <button type="submit" className="save-btn" disabled={saving}>
                        {saving ? 'Saving...' : '💾 Save Changes'}
                    </button>
                </form>
            </section>

            {/* Password Section */}
            <section className="account-section">
                <h2 className="section-title">
                    <span className="section-icon">🔒</span>
                    Security
                </h2>

                {!showPasswordForm ? (
                    <button
                        className="change-password-btn"
                        onClick={() => setShowPasswordForm(true)}
                    >
                        🔑 Change Password
                    </button>
                ) : (
                    <form onSubmit={handleChangePassword} className="password-form">
                        <div className="form-group">
                            <label htmlFor="currentPassword">Current Password</label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="newPassword">New Password</label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={8}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm New Password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {passwordMessage && (
                            <div className={`form-message ${passwordMessage.type}`}>
                                {passwordMessage.type === 'success' ? '✅' : '❌'} {passwordMessage.text}
                            </div>
                        )}

                        <div className="password-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => {
                                    setShowPasswordForm(false);
                                    setPasswordMessage(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="save-btn" disabled={passwordSaving}>
                                {passwordSaving ? 'Changing...' : '🔐 Change Password'}
                            </button>
                        </div>
                    </form>
                )}
            </section>

            {/* Account Stats */}
            <section className="account-section">
                <h2 className="section-title">
                    <span className="section-icon">📊</span>
                    Account Overview
                </h2>

                <div className="stats-grid">


                    <div className="stat-card">
                        <div className="stat-icon">📅</div>
                        <div className="stat-info">
                            <span className="stat-label">Member Since</span>
                            <span className="stat-value">
                                {user?.createdAt
                                    ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long'
                                    })
                                    : 'N/A'
                                }
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AccountTab;
