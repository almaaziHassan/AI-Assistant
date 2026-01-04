import React from 'react';
import { DashboardStats, AppointmentStats } from '../../types/admin';

interface OverviewProps {
    stats: DashboardStats;
    appointmentStats: AppointmentStats | null;
    onRefresh: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ stats, appointmentStats, onRefresh }) => {
    return (
        <>
            <div className="section-header">
                <h2>Overview</h2>
                <button className="btn-refresh" onClick={onRefresh} title="Refresh stats">
                    ↻ Refresh
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.todayAppointments}</div>
                    <div className="stat-label">Today's Appointments</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.weekAppointments}</div>
                    <div className="stat-label">This Week</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.monthAppointments}</div>
                    <div className="stat-label">This Month</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.upcomingCount}</div>
                    <div className="stat-label">Upcoming</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-value">{stats.cancelledCount}</div>
                    <div className="stat-label">Cancelled (30d)</div>
                </div>
                <div className="stat-card info">
                    <div className="stat-value">{stats.waitlistCount}</div>
                    <div className="stat-label">On Waitlist</div>
                </div>
                <div className="stat-card highlight">
                    <div className="stat-value">{stats.pendingCallbacksCount}</div>
                    <div className="stat-label">Pending Callbacks</div>
                </div>

                {/* Appointment Status Stats */}
                {appointmentStats && (
                    <>
                        {appointmentStats.pending > 0 && (
                            <div className="stat-card highlight">
                                <div className="stat-value">{appointmentStats.pending}</div>
                                <div className="stat-label">Pending Confirmation</div>
                            </div>
                        )}
                        <div className={`stat-card ${appointmentStats.noShowRate > 10 ? 'danger' : 'warning'}`}>
                            <div className="stat-value">{appointmentStats.noShow}</div>
                            <div className="stat-label">No-Shows (30d) - {appointmentStats.noShowRate}%</div>
                        </div>
                    </>
                )}

                {stats.topServices.length > 0 && (
                    <div className="stat-card wide">
                        <div className="stat-label">Top Services (30d)</div>
                        <div className="top-services">
                            {stats.topServices.map((s, i) => (
                                <div key={s.serviceId} className="service-stat">
                                    <span className="service-rank">#{i + 1}</span>
                                    <span className="service-name">{s.serviceName}</span>
                                    <span className="service-count">{s.count} bookings</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
