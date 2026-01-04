import React, { useState } from 'react';
import { CallbackRequest } from '../../types/admin';
import { formatDateTime, getPreferredTimeLabel } from '../../utils/admin';

interface CallbacksManagerProps {
    callbacks: CallbackRequest[];
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
    onRefresh: () => void;
    onLogout: () => void;
}

export const CallbacksManager: React.FC<CallbacksManagerProps> = ({
    callbacks,
    serverUrl,
    getAuthHeaders,
    onRefresh,
    onLogout
}) => {
    const [callbackFilter, setCallbackFilter] = useState('all');

    const filteredCallbacks = callbackFilter === 'all'
        ? callbacks
        : callbacks.filter(c => c.status === callbackFilter);

    const handleUpdateCallbackStatus = async (id: string, status: 'pending' | 'contacted' | 'completed' | 'no_answer', notes?: string) => {
        try {
            const res = await fetch(`${serverUrl}/api/callbacks/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status, notes })
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) {
                onRefresh();
            } else {
                alert('Failed to update callback status');
            }
        } catch {
            alert('Failed to update callback status');
        }
    };

    const handleDeleteCallback = async (id: string) => {
        if (!confirm('Are you sure you want to delete this callback request?')) return;

        try {
            const res = await fetch(`${serverUrl}/api/callbacks/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) onRefresh();
        } catch {
            alert('Failed to delete callback');
        }
    };

    return (
        <div className="callbacks-section">
            <div className="section-header">
                <h2>Callback Requests</h2>
                <div className="callback-filters">
                    <select
                        value={callbackFilter}
                        onChange={(e) => setCallbackFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="pending">Pending</option>
                        <option value="contacted">Contacted</option>
                        <option value="completed">Completed</option>
                        <option value="no_answer">No Answer</option>
                        <option value="all">All</option>
                    </select>
                </div>
            </div>

            {filteredCallbacks.length === 0 ? (
                <p className="no-data">No callback requests {callbackFilter !== 'all' ? `with status "${callbackFilter}"` : ''}</p>
            ) : (
                <div className="callbacks-list">
                    {filteredCallbacks.map(cb => (
                        <div key={cb.id} className={`callback-card status-${cb.status}`}>
                            <div className="callback-header">
                                <div className="callback-customer">
                                    <strong>{cb.customerName}</strong>
                                    <span className={`status-badge ${cb.status}`}>{cb.status.replace('_', ' ')}</span>
                                </div>
                                <div className="callback-time">
                                    {formatDateTime(cb.createdAt)}
                                </div>
                            </div>

                            <div className="callback-details">
                                <div className="callback-contact">
                                    <div className="contact-item">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                        </svg>
                                        <a href={`tel:${cb.customerPhone}`}>{cb.customerPhone}</a>
                                    </div>
                                    {cb.customerEmail && (
                                        <div className="contact-item">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                <polyline points="22,6 12,13 2,6" />
                                            </svg>
                                            <a href={`mailto:${cb.customerEmail}`}>{cb.customerEmail}</a>
                                        </div>
                                    )}
                                    <div className="contact-item">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        <span>{getPreferredTimeLabel(cb.preferredTime)}</span>
                                    </div>
                                </div>

                                {cb.concerns && (
                                    <div className="callback-concerns">
                                        <strong>Concerns:</strong>
                                        <p>{cb.concerns}</p>
                                    </div>
                                )}

                                {cb.notes && (
                                    <div className="callback-notes">
                                        <strong>Notes:</strong>
                                        <p>{cb.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="callback-actions">
                                {cb.status === 'pending' && (
                                    <>
                                        <button
                                            className="btn-small success"
                                            onClick={() => handleUpdateCallbackStatus(cb.id, 'contacted')}
                                        >
                                            Mark Contacted
                                        </button>
                                        <button
                                            className="btn-small warning"
                                            onClick={() => handleUpdateCallbackStatus(cb.id, 'no_answer')}
                                        >
                                            No Answer
                                        </button>
                                    </>
                                )}
                                {cb.status === 'contacted' && (
                                    <button
                                        className="btn-small success"
                                        onClick={() => handleUpdateCallbackStatus(cb.id, 'completed')}
                                    >
                                        Mark Completed
                                    </button>
                                )}
                                <button
                                    className="btn-small danger"
                                    onClick={() => handleDeleteCallback(cb.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
