/**
 * User Account Page
 * Displays and allows editing of user profile
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './UserPages.css';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

interface UserAccountPageProps {
    onBack: () => void;
}

const UserAccountPage: React.FC<UserAccountPageProps> = ({ onBack }) => {
    const { user, token, updateUser, logout } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Password change state
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveProfile = async () => {
        if (!name.trim()) {
            setMessage({ type: 'error', text: 'Name is required' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            const response = await fetch(`${API_URL}/api/user-auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: name.trim() })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                updateUser(data.user);
                setIsEditing(false);
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 8) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
            return;
        }

        setIsSaving(true);
        setPasswordMessage(null);

        try {
            const response = await fetch(`${API_URL}/api/user-auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowPasswordChange(false);
            } else {
                setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
            }
        } catch {
            setPasswordMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="user-page">
                <div className="user-page-container">
                    <p>Please log in to view your account.</p>
                    <button onClick={onBack} className="btn-secondary">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="user-page">
            <div className="user-page-container">
                <button className="back-button" onClick={onBack}>
                    ← Back to Home
                </button>

                <div className="user-page-header">
                    <div className="user-avatar-large">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <h1>My Account</h1>
                    <p className="user-email">{user.email}</p>
                </div>

                {message && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="user-card">
                    <h2>Profile Information</h2>

                    <div className="form-group">
                        <label>Name</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                            />
                        ) : (
                            <div className="form-value">{user.name}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <div className="form-value">{user.email}</div>
                    </div>

                    <div className="form-group">
                        <label>Account Type</label>
                        <div className="form-value capitalize">{user.role}</div>
                    </div>

                    <div className="button-group">
                        {isEditing ? (
                            <>
                                <button
                                    className="btn-primary"
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setName(user.name);
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button className="btn-primary" onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>

                <div className="user-card">
                    <h2>Security</h2>

                    {passwordMessage && (
                        <div className={`message ${passwordMessage.type}`}>
                            {passwordMessage.text}
                        </div>
                    )}

                    {showPasswordChange ? (
                        <div className="password-form">
                            <div className="form-group">
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                />
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                />
                            </div>
                            <div className="button-group">
                                <button
                                    className="btn-primary"
                                    onClick={handleChangePassword}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Changing...' : 'Change Password'}
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowPasswordChange(false);
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button className="btn-secondary" onClick={() => setShowPasswordChange(true)}>
                            Change Password
                        </button>
                    )}
                </div>

                <div className="user-card danger-zone">
                    <h2>Account Actions</h2>
                    <button className="btn-danger" onClick={() => { logout(); onBack(); }}>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserAccountPage;
