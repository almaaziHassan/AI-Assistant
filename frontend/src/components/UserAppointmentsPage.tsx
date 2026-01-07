/**
 * User Appointments Page
 * Displays user's appointments with ability to cancel
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './UserPages.css';

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

interface UserAppointmentsPageProps {
    onBack: () => void;
}

const UserAppointmentsPage: React.FC<UserAppointmentsPageProps> = ({ onBack }) => {
    const { user, token } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchAppointments();
        }
    }, [token, filter]);

    const fetchAppointments = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (filter === 'upcoming') {
                params.append('upcoming', 'true');
            }

            const response = await fetch(`${API_URL}/api/users/appointments?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setAppointments(data);
            } else {
                setError('Failed to load appointments');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelAppointment = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }

        setCancellingId(id);

        try {
            const response = await fetch(`${API_URL}/api/users/appointments/${id}/cancel`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Refresh appointments
                fetchAppointments();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to cancel appointment');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setCancellingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'confirmed': return 'status-confirmed';
            case 'pending': return 'status-pending';
            case 'cancelled': return 'status-cancelled';
            case 'completed': return 'status-completed';
            default: return '';
        }
    };

    const isPastAppointment = (dateStr: string) => {
        const appointmentDate = new Date(dateStr + 'T23:59:59');
        return appointmentDate < new Date();
    };

    // Filter appointments based on selected filter
    const filteredAppointments = appointments.filter(apt => {
        if (filter === 'upcoming') {
            return !isPastAppointment(apt.date) && apt.status !== 'cancelled';
        }
        if (filter === 'past') {
            return isPastAppointment(apt.date) || apt.status === 'completed';
        }
        return true;
    });

    if (!user) {
        return (
            <div className="user-page">
                <div className="user-page-container">
                    <p>Please log in to view your appointments.</p>
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
                    <h1>My Appointments</h1>
                    <p>View and manage your bookings</p>
                </div>

                <div className="filter-tabs">
                    <button
                        className={filter === 'upcoming' ? 'active' : ''}
                        onClick={() => setFilter('upcoming')}
                    >
                        Upcoming
                    </button>
                    <button
                        className={filter === 'past' ? 'active' : ''}
                        onClick={() => setFilter('past')}
                    >
                        Past
                    </button>
                    <button
                        className={filter === 'all' ? 'active' : ''}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading appointments...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <p>{error}</p>
                        <button onClick={fetchAppointments} className="btn-secondary">Try Again</button>
                    </div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📅</div>
                        <h3>No Appointments Found</h3>
                        <p>
                            {filter === 'upcoming'
                                ? "You don't have any upcoming appointments."
                                : filter === 'past'
                                    ? "You don't have any past appointments."
                                    : "You haven't booked any appointments yet."}
                        </p>
                        <button onClick={onBack} className="btn-primary">Book an Appointment</button>
                    </div>
                ) : (
                    <div className="appointments-list">
                        {filteredAppointments.map(apt => (
                            <div key={apt.id} className={`appointment-card ${isPastAppointment(apt.date) ? 'past' : ''}`}>
                                <div className="appointment-header">
                                    <h3>{apt.serviceName}</h3>
                                    <span className={`status-badge ${getStatusColor(apt.status)}`}>
                                        {apt.status}
                                    </span>
                                </div>

                                <div className="appointment-details">
                                    <div className="detail-row">
                                        <span className="detail-icon">📅</span>
                                        <span>{formatDate(apt.date)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-icon">🕐</span>
                                        <span>{formatTime(apt.time)} ({apt.duration} min)</span>
                                    </div>
                                    {apt.staffName && (
                                        <div className="detail-row">
                                            <span className="detail-icon">👤</span>
                                            <span>{apt.staffName}</span>
                                        </div>
                                    )}
                                    {apt.location && (
                                        <div className="detail-row">
                                            <span className="detail-icon">📍</span>
                                            <span>{apt.location}</span>
                                        </div>
                                    )}
                                </div>

                                {!isPastAppointment(apt.date) && apt.status !== 'cancelled' && (
                                    <div className="appointment-actions">
                                        <button
                                            className="btn-cancel"
                                            onClick={() => handleCancelAppointment(apt.id)}
                                            disabled={cancellingId === apt.id}
                                        >
                                            {cancellingId === apt.id ? 'Cancelling...' : 'Cancel Appointment'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserAppointmentsPage;
