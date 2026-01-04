import React, { useState } from 'react';
import { Holiday } from '../../types/admin';
import { formatDate } from '../../utils/admin';

interface HolidaysManagerProps {
    holidays: Holiday[];
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
    onRefresh: () => void;
    onLogout: () => void;
}

export const HolidaysManager: React.FC<HolidaysManagerProps> = ({
    holidays,
    serverUrl,
    getAuthHeaders,
    onRefresh,
    onLogout
}) => {
    const [showHolidayForm, setShowHolidayForm] = useState(false);
    const [holidayForm, setHolidayForm] = useState({ date: '', name: '', isClosed: true });

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${serverUrl}/api/admin/holidays`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(holidayForm)
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) {
                setShowHolidayForm(false);
                setHolidayForm({ date: '', name: '', isClosed: true });
                onRefresh();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to add holiday');
            }
        } catch {
            alert('Failed to add holiday');
        }
    };

    const handleDeleteHoliday = async (id: string) => {
        if (!confirm('Are you sure you want to delete this holiday?')) return;

        try {
            const res = await fetch(`${serverUrl}/api/admin/holidays/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) onRefresh();
        } catch {
            alert('Failed to delete holiday');
        }
    };

    return (
        <div className="holidays-section">
            <div className="section-header">
                <h2>Holidays & Closures</h2>
                <button className="btn-primary" onClick={() => setShowHolidayForm(!showHolidayForm)}>
                    {showHolidayForm ? 'Cancel' : '+ Add Holiday'}
                </button>
            </div>

            {showHolidayForm && (
                <form className="admin-form" onSubmit={handleAddHoliday}>
                    <input
                        type="date"
                        value={holidayForm.date}
                        onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Holiday name"
                        value={holidayForm.name}
                        onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                        required
                    />
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={holidayForm.isClosed}
                            onChange={e => setHolidayForm({ ...holidayForm, isClosed: e.target.checked })}
                        />
                        Closed all day
                    </label>
                    <button type="submit" className="btn-primary">Add Holiday</button>
                </form>
            )}

            {holidays.length === 0 ? (
                <p className="no-data">No holidays configured</p>
            ) : (
                <div className="holidays-list">
                    {holidays.map(h => (
                        <div key={h.id} className="holiday-card">
                            <div className="holiday-date">{formatDate(h.date)}</div>
                            <div className="holiday-name">{h.name}</div>
                            <div className="holiday-status">
                                {h.isClosed ? 'Closed' : 'Modified Hours'}
                            </div>
                            <button
                                className="btn-small danger"
                                onClick={() => handleDeleteHoliday(h.id)}
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
