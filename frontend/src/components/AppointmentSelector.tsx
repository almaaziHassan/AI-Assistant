import React from 'react';

interface Appointment {
    id: string;
    serviceName: string;
    date: string;
    time: string;
    staffName?: string;
}

interface AppointmentSelectorProps {
    appointments: Appointment[];
    onCancel: (appointmentId: string, serviceName: string) => void;
    onReschedule: (appointmentId: string, serviceName: string) => void;
    onClose: () => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(dateStr: string): string {
    try {
        // Handle YYYY-MM-DD format
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${day}`;
        }
        // Try parsing other formats
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
        }
    } catch { }
    return dateStr;
}

function formatTime(timeStr: string): string {
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
    } catch { }
    return timeStr;
}

const AppointmentSelector: React.FC<AppointmentSelectorProps> = ({
    appointments,
    onCancel,
    onReschedule,
    onClose
}) => {
    return (
        <div className="appointment-selector">
            <div className="appointment-selector-header">
                <h3>📅 Your Appointments</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <div className="appointment-list">
                {appointments.map((apt, index) => (
                    <div key={apt.id} className="appointment-card">
                        <div className="appointment-info">
                            <div className="appointment-number">{index + 1}</div>
                            <div className="appointment-details">
                                <div className="service-name">{apt.serviceName}</div>
                                <div className="date-time">
                                    {formatDate(apt.date)} at {formatTime(apt.time)}
                                </div>
                                {apt.staffName && (
                                    <div className="staff-name">with {apt.staffName}</div>
                                )}
                            </div>
                        </div>
                        <div className="appointment-actions">
                            <button
                                className="action-btn reschedule-btn"
                                onClick={() => onReschedule(apt.id, apt.serviceName)}
                            >
                                📅 Reschedule
                            </button>
                            <button
                                className="action-btn cancel-btn"
                                onClick={() => onCancel(apt.id, apt.serviceName)}
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AppointmentSelector;
