import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Appointment } from '../../types/admin';
import { formatDate, formatTime } from '../../utils/admin';

const localizer = momentLocalizer(moment);

// Define the event type for the calendar
interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource: Appointment;
    status: string;
}

interface AppointmentsProps {
    appointments: Appointment[];
    viewMode: 'table' | 'calendar';
    setViewMode: (mode: 'table' | 'calendar') => void;
    filter: 'today' | 'week' | 'month' | 'all';
    setFilter: (filter: 'today' | 'week' | 'month' | 'all') => void;
    onUpdateStatus: (id: string, status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled') => void;
}

export const Appointments: React.FC<AppointmentsProps> = ({
    appointments,
    viewMode,
    setViewMode,
    filter,
    setFilter,
    onUpdateStatus
}) => {
    return (
        <div className="appointments-list">
            <div className="section-header">
                <h2>Appointments</h2>
                <div style={{ display: 'flex', gap: '10px', marginRight: 'auto', marginLeft: '20px' }}>
                    <button
                        className={`filter-btn ${viewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setViewMode('table')}
                    >
                        Table
                    </button>
                    <button
                        className={`filter-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                        onClick={() => setViewMode('calendar')}
                    >
                        Calendar
                    </button>
                </div>
                <div className="date-filter-buttons">
                    {(['today', 'week', 'month', 'all'] as const).map(f => (
                        <button
                            key={f}
                            className={`filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {viewMode === 'calendar' ? (() => {
                // Build typed events array outside JSX to fix TypeScript errors
                const calendarEvents: CalendarEvent[] = appointments
                    .map(apt => {
                        // Parse date - handle both ISO string and Date objects
                        let dateStr: string;
                        const dateVal = apt.appointment_date as unknown;
                        if (typeof dateVal === 'string') {
                            dateStr = dateVal.split('T')[0];
                        } else if (dateVal instanceof Date) {
                            dateStr = dateVal.toISOString().split('T')[0];
                        } else {
                            dateStr = String(dateVal).split('T')[0];
                        }

                        // Parse time - handle multiple formats:
                        // 1. HH:MM (e.g., "09:00")
                        // 2. HH:MM:SS (e.g., "09:00:00")
                        // 3. Full ISO date (e.g., "1970-01-01T09:00:00.000Z") - extract time portion
                        let timeStr = String(apt.appointment_time || '00:00');

                        // If it contains 'T', it's an ISO date string - extract time after T
                        if (timeStr.includes('T')) {
                            const timePart = timeStr.split('T')[1]; // Gets "09:00:00.000Z"
                            timeStr = timePart ? timePart.substring(0, 5) : '00:00'; // Gets "09:00"
                        } else if (timeStr.length > 5) {
                            timeStr = timeStr.substring(0, 5); // Get HH:MM from HH:MM:SS
                        }

                        const start = new Date(`${dateStr}T${timeStr}:00`);
                        const duration = Number(apt.duration) || 30;
                        const end = new Date(start.getTime() + duration * 60000);



                        // Skip invalid dates
                        if (isNaN(start.getTime())) {
                            console.warn('Invalid appointment date/time:', apt.appointment_date, apt.appointment_time);
                            return null;
                        }

                        return {
                            id: apt.id,
                            title: `${apt.customer_name} (${apt.service_name})`,
                            start,
                            end,
                            resource: apt,
                            status: apt.status
                        };
                    })
                    .filter((event): event is CalendarEvent => event !== null);

                return (
                    <div style={{ height: '700px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <Calendar<CalendarEvent>
                            localizer={localizer}
                            events={calendarEvents}
                            defaultDate={new Date()}
                            startAccessor={(event) => event.start}
                            endAccessor={(event) => event.end}
                            style={{ height: '100%' }}
                            eventPropGetter={(event: CalendarEvent) => {
                                let backgroundColor = '#3174ad'; // confirmed/default
                                if (event.status === 'cancelled') backgroundColor = '#e74c3c';
                                if (event.status === 'pending') backgroundColor = '#f39c12';
                                if (event.status === 'completed') backgroundColor = '#27ae60';
                                if (event.status === 'no-show') backgroundColor = '#7f8c8d';
                                return { style: { backgroundColor } };
                            }}
                            onSelectEvent={(event: CalendarEvent) => {
                                alert(`Appointment Details:\n\nCustomer: ${event.resource.customer_name}\nService: ${event.resource.service_name}\nStaff: ${event.resource.staff_name || 'Unassigned'}\nTime: ${moment(event.start).format('h:mm A')} - ${moment(event.end).format('h:mm A')}\nStatus: ${event.status}`);
                            }}
                        />
                    </div>
                );
            })() : appointments.length === 0 ? (
                <p className="no-data">No appointments found</p>
            ) : (
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Customer</th>
                            <th>Service</th>
                            <th>Staff</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {appointments.map(apt => (
                            <tr key={apt.id} className={apt.status === 'cancelled' ? 'cancelled' : ''}>
                                <td>{formatDate(apt.appointment_date)}</td>
                                <td>{formatTime(apt.appointment_time)}</td>
                                <td>
                                    <div>{apt.customer_name}</div>
                                    <div className="sub-text">{apt.customer_email}</div>
                                </td>
                                <td>{apt.service_name}</td>
                                <td>{apt.staff_name || '-'}</td>
                                <td>
                                    <span className={`status-badge ${apt.status}`}>{apt.status}</span>
                                </td>
                                <td className="actions-cell">
                                    {(() => {
                                        // Check if appointment is in the future
                                        // Handle both Date object and string - use typeof since appointment_date is typed as string
                                        const dateVal = apt.appointment_date as unknown;
                                        let aptDate: string;
                                        if (typeof dateVal === 'object' && dateVal !== null && 'toISOString' in dateVal) {
                                            aptDate = (dateVal as Date).toISOString().split('T')[0];
                                        } else {
                                            aptDate = String(apt.appointment_date).split('T')[0];
                                        }
                                        const aptDateTime = new Date(`${aptDate}T${apt.appointment_time}`);
                                        const now = new Date();
                                        const isFuture = aptDateTime > now;

                                        // Future appointments: Only Cancel is available (for pending or confirmed)
                                        if (isFuture && (apt.status === 'pending' || apt.status === 'confirmed')) {
                                            return (
                                                <button
                                                    className="btn-small danger"
                                                    onClick={() => onUpdateStatus(apt.id, 'cancelled')}
                                                >
                                                    Cancel
                                                </button>
                                            );
                                        }

                                        // Past appointments: Only show actions if status is 'pending'
                                        // Once confirmed, cancelled, or no-show - no more actions needed
                                        if (!isFuture && apt.status === 'pending') {
                                            return (
                                                <>
                                                    <button
                                                        className="btn-small success"
                                                        onClick={() => onUpdateStatus(apt.id, 'confirmed')}
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        className="btn-small danger"
                                                        onClick={() => onUpdateStatus(apt.id, 'cancelled')}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className="btn-small warning"
                                                        onClick={() => onUpdateStatus(apt.id, 'no-show')}
                                                    >
                                                        No Show
                                                    </button>
                                                </>
                                            );
                                        }

                                        return null;
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
