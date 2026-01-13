import React, { useState } from 'react';
import useSWR from 'swr';
import { Staff, Service, WeeklySchedule } from '../../types/admin';
import { BusinessHoursModal } from './BusinessHoursModal';

interface StaffManagerProps {
    staff: Staff[];
    availableServices: Service[];
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
    onRefresh: () => void;
    onLogout: () => void;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
    staff,
    availableServices,
    serverUrl,
    getAuthHeaders,
    onRefresh,
    onLogout
}) => {
    const [showStaffForm, setShowStaffForm] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [staffForm, setStaffForm] = useState<{
        name: string;
        email: string;
        role: string;
        services: string[];
        schedule?: WeeklySchedule;
    }>({ name: '', email: '', role: 'staff', services: [] });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Business Hours State
    const [showHoursModal, setShowHoursModal] = useState(false);

    // Fetch Global Business Hours
    const { data: businessHoursSetting, mutate: mutateHours } = useSWR<{ value: WeeklySchedule }>(
        `${serverUrl}/api/admin/settings/hours`,
        async (url: string) => {
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) {
                // If 404, return default/null structure rather than throw, but API usually returns 404 if missing. 
                // We'll let it error or handle 404. adminPrisma returns 404.
                if (res.status === 404) return { value: null };
                throw new Error('Failed to fetch hours');
            }
            return res.json();
        }
    );

    const handleSaveHours = async (hours: WeeklySchedule) => {
        try {
            const res = await fetch(`${serverUrl}/api/admin/settings/hours`, {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders() as Record<string, string>,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: hours, description: 'General Office Hours' })
            });

            if (res.status === 401) { onLogout(); return; }

            if (res.ok) {
                mutateHours();
                // We also might want to refresh overview stats or config if used there?
            } else {
                alert('Failed to update office hours');
            }
        } catch (e) {
            alert('Failed to save office hours');
            throw e; // Modal catches this
        }
    };

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const url = editingStaffId
                ? `${serverUrl}/api/admin/staff/${editingStaffId}`
                : `${serverUrl}/api/admin/staff`;
            const method = editingStaffId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    ...getAuthHeaders() as Record<string, string>,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(staffForm)
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) {
                onRefresh();
                setShowStaffForm(false);
                setEditingStaffId(null);
                setStaffForm({ name: '', email: '', role: 'staff', services: [] });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save staff');
            }
        } catch {
            alert('Failed to save staff');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditStaff = (staffMember: Staff) => {
        setStaffForm({
            name: staffMember.name,
            email: staffMember.email || '',
            role: staffMember.role,
            services: staffMember.services || [],
            schedule: staffMember.schedule
        });
        setEditingStaffId(staffMember.id);
        setShowStaffForm(true);
    };

    const handleDeleteStaff = async (id: string) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return;

        try {
            const res = await fetch(`${serverUrl}/api/admin/staff/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) {
                onRefresh();
            }
        } catch {
            alert('Failed to delete staff');
        }
    };

    return (
        <div className="staff-section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{editingStaffId ? 'Edit Staff Member' : 'Staff Members'}</h2>
                <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="btn-secondary"
                        onClick={() => setShowHoursModal(true)}
                    >
                        General Office Hours
                    </button>
                    <button className="btn-primary" onClick={() => {
                        if (showStaffForm) {
                            setShowStaffForm(false);
                            setEditingStaffId(null);
                            setStaffForm({ name: '', email: '', role: 'staff', services: [] });
                        } else {
                            setShowStaffForm(true);
                        }
                    }}>
                        {showStaffForm ? 'Cancel' : '+ Add Staff'}
                    </button>
                </div>
            </div>

            <BusinessHoursModal
                isOpen={showHoursModal}
                onClose={() => setShowHoursModal(false)}
                initialHours={businessHoursSetting?.value || null}
                onSave={handleSaveHours}
            />

            {showStaffForm && (
                <form className="admin-form" onSubmit={handleAddStaff}>
                    <input
                        type="text"
                        placeholder="Name"
                        value={staffForm.name}
                        onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email (optional)"
                        value={staffForm.email}
                        onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    />
                    <select
                        value={staffForm.role}
                        onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                    >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                    </select>

                    {/* Service selection */}
                    {availableServices.length > 0 && (
                        <div className="service-checkboxes">
                            <label className="checkbox-group-label">Services this staff can provide:</label>
                            <div className="checkbox-group">
                                {availableServices.map(service => (
                                    <label key={service.id} className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={staffForm.services.includes(service.id)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setStaffForm({ ...staffForm, services: [...staffForm.services, service.id] });
                                                } else {
                                                    setStaffForm({ ...staffForm, services: staffForm.services.filter(id => id !== service.id) });
                                                }
                                            }}
                                        />
                                        {service.name}
                                    </label>
                                ))}
                            </div>
                            <small className="helper-text">Leave all unchecked if staff can provide all services</small>
                        </div>
                    )}

                    {/* Schedule Editor */}
                    <div style={{ marginTop: '20px' }}>
                        <label className="checkbox-group-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Working Hours (Optional)</label>
                        <small className="helper-text" style={{ display: 'block', marginBottom: '15px' }}>Check days this staff member works. Unchecked days are considered OFF.</small>

                        <div className="schedule-grid">
                            {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => {
                                const currentSchedule = staffForm.schedule?.[day];
                                const isActive = !!currentSchedule;

                                return (
                                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <div style={{ width: '100px', fontWeight: 500 }}>{day.charAt(0).toUpperCase() + day.slice(1)}</div>
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={(e) => {
                                                let newSchedule: WeeklySchedule = {
                                                    ...(staffForm.schedule || {
                                                        monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null
                                                    })
                                                };

                                                if (e.target.checked) {
                                                    newSchedule[day] = { start: '09:00', end: '17:00' };
                                                } else {
                                                    newSchedule[day] = null;
                                                }
                                                setStaffForm({ ...staffForm, schedule: newSchedule });
                                            }}
                                        />

                                        {isActive && (
                                            <>
                                                <input
                                                    type="time"
                                                    value={currentSchedule!.start}
                                                    onChange={(e) => {
                                                        if (!staffForm.schedule) return;
                                                        const newSchedule = { ...staffForm.schedule };
                                                        if (newSchedule[day]) {
                                                            newSchedule[day]!.start = e.target.value;
                                                            setStaffForm({ ...staffForm, schedule: newSchedule });
                                                        }
                                                    }}
                                                    style={{ width: '110px' }}
                                                />
                                                <span>to</span>
                                                <input
                                                    type="time"
                                                    value={currentSchedule!.end}
                                                    onChange={(e) => {
                                                        if (!staffForm.schedule) return;
                                                        const newSchedule = { ...staffForm.schedule };
                                                        if (newSchedule[day]) {
                                                            newSchedule[day]!.end = e.target.value;
                                                            setStaffForm({ ...staffForm, schedule: newSchedule });
                                                        }
                                                    }}
                                                    style={{ width: '110px' }}
                                                />
                                            </>
                                        )}
                                        {!isActive && <span style={{ color: '#888', fontStyle: 'italic' }}>Off</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <button type="submit" className="btn-primary">{editingStaffId ? 'Update Staff & Schedule' : 'Update Staff'}</button>
                </form>
            )}

            {staff.length === 0 ? (
                <p className="no-data">No staff members added yet</p>
            ) : (
                <div className="staff-grid">
                    {staff.map(s => {
                        const serviceNames = s.services && s.services.length > 0
                            ? s.services.map(svcId => {
                                const svc = availableServices.find(sv => sv.id === svcId);
                                return svc ? svc.name : svcId;
                            })
                            : [];

                        return (
                            <div key={s.id} className={`staff-card ${!s.isActive ? 'inactive' : ''}`}>
                                <div className="staff-name">{s.name}</div>
                                <div className="staff-role">{s.role}</div>
                                {s.email && <div className="staff-email">{s.email}</div>}
                                {serviceNames.length > 0 ? (
                                    <div className="staff-services">
                                        <strong>Services:</strong> {serviceNames.join(', ')}
                                    </div>
                                ) : (
                                    <div className="staff-services all-services">All Services</div>
                                )}
                                {s.schedule ? (
                                    <div className="staff-schedule" style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
                                        <strong>Schedule: </strong>
                                        <span style={{ color: '#2980b9' }}>Custom (Edit to view)</span>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.85em', color: '#999', marginTop: '5px' }}>Schedule: Default Hours</div>
                                )}

                                <div className="card-actions" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn-small"
                                        onClick={() => handleEditStaff(s)}
                                        style={{ backgroundColor: '#3498db', color: 'white', border: 'none' }}
                                    >
                                        Edit / Schedule
                                    </button>
                                    <button
                                        className="btn-small danger"
                                        onClick={() => handleDeleteStaff(s.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
