import React, { useState, useEffect } from 'react';
import { WeeklySchedule } from '../../types/admin';
import '../../styles/admin.css';

interface BusinessHoursModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialHours: WeeklySchedule | null;
    onSave: (hours: WeeklySchedule) => Promise<void>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const BusinessHoursModal: React.FC<BusinessHoursModalProps> = ({ isOpen, onClose, initialHours, onSave }) => {
    const [schedule, setSchedule] = useState<WeeklySchedule>({
        monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialHours) {
            setSchedule(initialHours);
        } else {
            // Default 9-5 M-F
            const defaultDay = { start: '09:00', end: '17:00' };
            setSchedule({
                monday: defaultDay,
                tuesday: defaultDay,
                wednesday: defaultDay,
                thursday: defaultDay,
                friday: defaultDay,
                saturday: null,
                sunday: null
            });
        }
    }, [isOpen, initialHours]);

    const handleDayChange = (day: keyof WeeklySchedule, field: 'start' | 'end' | 'isOpen', value: string | boolean) => {
        setSchedule(prev => {
            const current = prev[day];
            if (field === 'isOpen') {
                if (value === true) {
                    return { ...prev, [day]: { start: '09:00', end: '17:00' } };
                } else {
                    return { ...prev, [day]: null };
                }
            } else {
                if (!current) return prev;
                return { ...prev, [day]: { ...current, [field]: value as string } };
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(schedule);
            onClose();
        } catch (e) {
            // Error handled by parent
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>General Office Hours</h2>
                <div className="hours-grid">
                    {DAYS.map(day => {
                        const daySchedule = schedule[day];
                        const isOpen = !!daySchedule;
                        return (
                            <div key={day} className="hour-row">
                                <label className="day-label">
                                    <input
                                        type="checkbox"
                                        checked={isOpen}
                                        onChange={(e) => handleDayChange(day, 'isOpen', e.target.checked)}
                                    />
                                    {day.charAt(0).toUpperCase() + day.slice(1)}
                                </label>
                                {isOpen ? (
                                    <div className="time-inputs">
                                        <input
                                            type="time"
                                            className="admin-input"
                                            value={daySchedule!.start}
                                            onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                                        />
                                        <span className="time-separator">to</span>
                                        <input
                                            type="time"
                                            className="admin-input"
                                            value={daySchedule!.end}
                                            onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <span className="closed-text">Closed</span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Hours'}
                    </button>
                </div>
            </div>
        </div>
    );
};
