/**
 * Appointments Tab Component
 * Shows user's appointments in a card layout
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

interface Appointment {
    id: string;
    serviceName: string;
    date: string;
    time: string;
    duration: number;
    status: string;
    staffName?: string;
    location?: string;
}

interface AppointmentsTabProps {
    serverUrl?: string;
}

const AppointmentsTab: React.FC<AppointmentsTabProps> = ({ serverUrl = API_URL }) => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    useEffect(() => {
        fetchAppointments();
    }, [user?.email]);

    const fetchAppointments = async () => {
        if (!user?.email) return;

        try {
            setLoading(true);
            const response = await fetch(`${serverUrl}/api/appointments/by-email/${encodeURIComponent(user.email)}`);
            if (!response.ok) throw new Error('Failed to fetch appointments');

            const data = await response.json();
            // Sort by date (upcoming first)
            const sorted = data.sort((a: Appointment, b: Appointment) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            setAppointments(sorted);
        } catch (err) {
            setError('Failed to load appointments');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelAppointment = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;

        setCancellingId(id);
        try {
            const response = await fetch(`${serverUrl}/api/appointments/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to cancel appointment');

            // Refresh appointments
            await fetchAppointments();
        } catch (err) {
            alert('Failed to cancel appointment. Please try again.');
            console.error(err);
        } finally {
            setCancellingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return date.toLocaleDateString('en-US', options);
    };

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    const getStatusBadge = (status: string) => {
        const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
            confirmed: { bg: '#dcfce7', color: '#166534', label: '✓ Confirmed' },
            pending: { bg: '#fef3c7', color: '#92400e', label: '⏳ Pending' },
            cancelled: { bg: '#fee2e2', color: '#991b1b', label: '✕ Cancelled' },
            completed: { bg: '#e0e7ff', color: '#3730a3', label: '✓ Completed' },
            'no-show': { bg: '#f3f4f6', color: '#6b7280', label: 'No Show' }
        };
        const style = statusStyles[status] || statusStyles.pending;
        return (
            <span
                className="status-badge"
                style={{
                    background: style.bg,
                    color: style.color,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                }}
            >
                {style.label}
            </span>
        );
    };

    const isPastAppointment = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const aptDate = new Date(dateStr + 'T00:00:00');
        return aptDate < today;
    };

    const upcomingAppointments = appointments.filter(
        apt => !isPastAppointment(apt.date) && apt.status !== 'cancelled' && apt.status !== 'completed'
    );

    const pastAppointments = appointments.filter(
        apt => isPastAppointment(apt.date) || apt.status === 'cancelled' || apt.status === 'completed'
    );

    if (loading) {
        return (
            <div className="appointments-loading">
                <div className="spinner"></div>
                <p>Loading your appointments...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="appointments-error">
                <p>❌ {error}</p>
                <button onClick={fetchAppointments}>Try Again</button>
            </div>
        );
    }

    return (
        <div className="appointments-tab">
            {/* Upcoming Appointments */}
            <div className="appointments-section">
                <h2 className="section-title">
                    <span className="section-icon">📅</span>
                    Upcoming Appointments
                </h2>

                {upcomingAppointments.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <h3>No Upcoming Appointments</h3>
                        <p>You don't have any upcoming appointments. Use the chat to book one!</p>
                    </div>
                ) : (
                    <div className="appointments-grid">
                        {upcomingAppointments.map(apt => (
                            <div key={apt.id} className="appointment-card">
                                <div className="card-header">
                                    <h3 className="service-name">{apt.serviceName}</h3>
                                    {getStatusBadge(apt.status)}
                                </div>

                                <div className="card-details">
                                    <div className="detail-row">
                                        <span className="detail-icon">📆</span>
                                        <span className="detail-text">{formatDate(apt.date)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-icon">🕐</span>
                                        <span className="detail-text">{formatTime(apt.time)}</span>
                                    </div>
                                    {apt.staffName && (
                                        <div className="detail-row">
                                            <span className="detail-icon">👤</span>
                                            <span className="detail-text">with {apt.staffName}</span>
                                        </div>
                                    )}
                                    <div className="detail-row">
                                        <span className="detail-icon">⏱️</span>
                                        <span className="detail-text">{apt.duration} minutes</span>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <button
                                        className="action-btn reschedule-btn"
                                        onClick={() => {
                                            // Open chat with reschedule intent
                                            const event = new CustomEvent('openChatWithIntent', {
                                                detail: { intent: 'reschedule', appointmentId: apt.id }
                                            });
                                            window.dispatchEvent(event);
                                        }}
                                    >
                                        📅 Reschedule
                                    </button>
                                    <button
                                        className="action-btn cancel-btn"
                                        onClick={() => handleCancelAppointment(apt.id)}
                                        disabled={cancellingId === apt.id}
                                    >
                                        {cancellingId === apt.id ? '...' : '✕ Cancel'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
                <div className="appointments-section past-section">
                    <h2 className="section-title">
                        <span className="section-icon">📜</span>
                        Past Appointments
                    </h2>

                    <div className="appointments-grid">
                        {pastAppointments.slice(0, 5).map(apt => (
                            <div key={apt.id} className="appointment-card past">
                                <div className="card-header">
                                    <h3 className="service-name">{apt.serviceName}</h3>
                                    {getStatusBadge(apt.status)}
                                </div>

                                <div className="card-details">
                                    <div className="detail-row">
                                        <span className="detail-icon">📆</span>
                                        <span className="detail-text">{formatDate(apt.date)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-icon">🕐</span>
                                        <span className="detail-text">{formatTime(apt.time)}</span>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <button
                                        className="action-btn book-again-btn"
                                        onClick={() => {
                                            const event = new CustomEvent('openChatWithIntent', {
                                                detail: { intent: 'book', serviceName: apt.serviceName }
                                            });
                                            window.dispatchEvent(event);
                                        }}
                                    >
                                        🔄 Book Again
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentsTab;
