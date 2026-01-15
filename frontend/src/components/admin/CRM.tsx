import React, { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';

interface CRMProps {
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
}

interface ContactListResponse {
    contacts: ContactListItem[];
    total: number;
}

interface ContactListItem {
    id: string;
    name: string;
    email: string;
    phone?: string;
    type: 'user' | 'guest';
    tags: string[];
    isBlocked: boolean;
    stats: {
        totalSpend: number;
        totalVisits: number;
        noShowCount: number;
        reliabilityScore: number;
        lastVisitDate: string | null;
    };
    lastSeenAt: string | null;
}

interface CustomerDetail {
    profile: ContactListItem;
    timeline: TimelineEvent[];
    notes: string | null;
}

interface TimelineEvent {
    id: string;
    type: 'appointment' | 'chat' | 'callback' | 'note';
    date: string;
    title: string;
    description?: string;
    status?: string;
    details?: any;
}

const CRMNotesEditor: React.FC<{ initialNotes: string | null, onSave: (notes: string) => Promise<void> }> = ({ initialNotes, onSave }) => {
    const [notes, setNotes] = useState(initialNotes || '');
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        setNotes(initialNotes || '');
    }, [initialNotes]);

    const handleSave = async () => {
        setStatus('saving');
        await onSave(notes);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
    };

    return (
        <div>
            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', background: '#fffbeb', marginBottom: '10px' }}
                placeholder="Add internal notes..."
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                    onClick={handleSave}
                    disabled={status === 'saving'}
                    style={{ padding: '6px 16px', background: '#FFC107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    {status === 'saving' ? 'Saving...' : '💾 Save Note'}
                </button>
                {status === 'saved' && <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✅ Saved!</span>}
            </div>
        </div>
    );
};

export const CRM: React.FC<CRMProps> = ({ serverUrl, getAuthHeaders }) => {
    const { mutate } = useSWRConfig();
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // List State
    const [page] = useState(1);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'vip'>('all');

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);

    // Broadcast Modal State
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastSegment, setBroadcastSegment] = useState<'all' | 'vip' | 'guests'>('all');
    const [broadcastSubject, setBroadcastSubject] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    // Load Contacts
    const fetcher = (url: string) => fetch(url, { headers: getAuthHeaders() }).then(res => res.json());

    const { data: listData, error: listError } = useSWR<ContactListResponse>(
        view === 'list'
            ? `${serverUrl}/api/admin/crm/contacts?page=${page}&limit=20&search=${search}&filter=${filter}`
            : null,
        fetcher
    );

    // Load Detail
    const { data: detailData, mutate: mutateDetail } = useSWR<CustomerDetail>(
        view === 'detail' && selectedId
            ? `${serverUrl}/api/admin/crm/contacts/${selectedId}`
            : null,
        fetcher
    );

    const handleSelectCustomer = (id: string) => {
        setSelectedId(id);
        setView('detail');
    };

    const handleBack = () => {
        setView('list');
        setSelectedId(null);
    };

    const handleSync = async () => {
        try {
            await fetch(`${serverUrl}/api/admin/crm/sync`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            mutate(`${serverUrl}/api/admin/crm/contacts?page=${page}&limit=20&search=${search}&filter=${filter}`);
            alert('Synced & Auto-tagged customers!');
        } catch (err) {
            console.error("Sync failed", err);
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastSubject || !broadcastMessage) return;
        setSendingBroadcast(true);
        try {
            const res = await fetch(`${serverUrl}/api/admin/crm/broadcast`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment: broadcastSegment,
                    subject: broadcastSubject,
                    message: broadcastMessage
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Broadcast Sent!\nSuccessful: ${data.sent}\nFailed: ${data.failed}`);
                setShowBroadcastModal(false);
                setBroadcastSubject('');
                setBroadcastMessage('');
            } else {
                alert('Broadcast failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error sending broadcast');
        } finally {
            setSendingBroadcast(false);
        }
    };

    // --- Render ---

    if (view === 'list') {
        return (
            <div className="crm-container" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2>Customer Relationship Management</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setShowBroadcastModal(true)} style={{ padding: '8px 16px', background: '#673AB7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            📣 Broadcast
                        </button>
                        <button onClick={handleSync} style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            🔄 Sync & Tag
                        </button>
                    </div>
                </div>

                {showBroadcastModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
                            <h3 style={{ marginTop: 0 }}>📢 New Broadcast Campaign</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>Audience Segment</label>
                                <select
                                    value={broadcastSegment}
                                    onChange={(e) => setBroadcastSegment(e.target.value as any)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
                                >
                                    <option value="all">All Customers</option>
                                    <option value="vip">💎 VIPs Only (Spent &gt; $500)</option>
                                    <option value="guests">👤 Guests Only (No Account)</option>
                                </select>
                            </div>

                            <input
                                type="text"
                                placeholder="Subject"
                                value={broadcastSubject}
                                onChange={e => setBroadcastSubject(e.target.value)}
                                style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                            <textarea
                                placeholder="Message... (Use HTML if desired)"
                                value={broadcastMessage}
                                onChange={e => setBroadcastMessage(e.target.value)}
                                style={{ width: '100%', height: '150px', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button onClick={() => setShowBroadcastModal(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                <button
                                    onClick={handleBroadcast}
                                    disabled={sendingBroadcast || !broadcastSubject || !broadcastMessage}
                                    style={{ padding: '8px 16px', background: '#673AB7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: sendingBroadcast ? 0.7 : 1 }}
                                >
                                    {sendingBroadcast ? 'Sending...' : '🚀 Send Campaign'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="controls" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search email or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: '8px', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <select value={filter} onChange={(e) => setFilter(e.target.value as 'all')} style={{ padding: '8px', borderRadius: '4px' }}>
                        <option value="all">All Customers</option>
                        <option value="vip">VIP Only</option>
                    </select>
                </div>

                {listError && <div className="error">Failed to load contacts</div>}
                {!listData && !listError && <div>Loading...</div>}

                {listData && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead style={{ background: '#f5f5f5' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Reliability</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Total Spend</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Last Seen</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listData.contacts.map(contact => (
                                <tr key={contact.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 'bold' }}>{contact.name}</div>
                                        <div style={{ fontSize: '0.8em', color: '#666' }}>{contact.email}</div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {contact.type === 'user' && <span style={{ background: '#e3f2fd', color: '#1976d2', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em' }}>User</span>}
                                        {contact.tags.includes('vip') && <span style={{ background: '#fce4ec', color: '#c2185b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em', marginLeft: '5px' }}>VIP</span>}
                                        {contact.isBlocked && <span style={{ background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em', marginLeft: '5px' }}>BLOCKED</span>}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <div style={{ width: '50px', height: '6px', background: '#eee', borderRadius: '3px' }}>
                                                <div style={{ width: `${contact.stats.reliabilityScore}%`, height: '100%', background: contact.stats.reliabilityScore > 80 ? '#4CAF50' : '#f44336', borderRadius: '3px' }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.8rem' }}>{contact.stats.reliabilityScore}%</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>${contact.stats.totalSpend}</td>
                                    <td style={{ padding: '12px' }}>{contact.lastSeenAt ? new Date(contact.lastSeenAt).toLocaleDateString() : 'Never'}</td>
                                    <td style={{ padding: '12px' }}>
                                        <button
                                            onClick={() => handleSelectCustomer(contact.id)}
                                            style={{ padding: '4px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    // View === 'detail'
    if (!detailData) return <div style={{ padding: '20px' }}>Loading profile...</div>;

    const { profile, timeline, notes } = detailData;

    const updateProfileCheck = async (updates: any) => {
        await fetch(`${serverUrl}/api/admin/crm/contacts/${profile.id}`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        mutateDetail();
        mutate(`${serverUrl}/api/admin/crm/contacts?page=${page}&limit=20&search=${search}&filter=${filter}`);
    };

    const handleSendEmail = async () => {
        if (!emailSubject || !emailMessage) return;
        setSendingEmail(true);
        try {
            const res = await fetch(`${serverUrl}/api/admin/crm/contacts/${profile.id}/email`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: emailSubject, message: emailMessage })
            });
            if (res.ok) {
                alert('Email sent successfully!');
                setShowEmailModal(false);
                setEmailSubject('');
                setEmailMessage('');
            } else {
                alert('Failed to send email.');
            }
        } catch (e) {
            console.error(e);
            alert('Error sending email.');
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <div className="crm-detail" style={{ padding: '20px', display: 'grid', gridTemplateColumns: '300px 1fr 250px', gap: '20px' }}>

            {/* LEFT COLUMN: Profile info */}
            <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <button onClick={handleBack} style={{ marginBottom: '10px', fontSize: '0.9em', cursor: 'pointer', background: 'none', border: 'none', color: '#666' }}>← Back to List</button>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#eee', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2em' }}>
                        {profile.name.charAt(0)}
                    </div>
                    <h2>{profile.name}</h2>
                    <div style={{ color: '#666' }}>{profile.email}</div>
                    {profile.phone && <div style={{ color: '#666' }}>{profile.phone}</div>}
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <h4>Tags</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {profile.tags.map(tag => (
                            <span key={tag} style={{ background: '#eee', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em' }}>{tag}</span>
                        ))}
                        <button
                            onClick={() => {
                                const newTag = prompt("Enter tag:");
                                if (newTag) updateProfileCheck({ tags: [...profile.tags, newTag] });
                            }}
                            style={{ background: 'none', border: '1px dashed #ccc', borderRadius: '12px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.8em' }}
                        >+ Add</button>
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <h4>Private Notes</h4>
                    <CRMNotesEditor initialNotes={notes} onSave={(newNotes) => updateProfileCheck({ notes: newNotes })} />
                </div>
            </div>

            {/* MIDDLE COLUMN: Timeline */}
            <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3>Unified Timeline</h3>
                <div className="timeline" style={{ marginTop: '20px' }}>
                    {timeline.map(event => (
                        <div key={event.id} style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: event.type === 'chat' ? '#e3f2fd' : (event.type === 'appointment' ? '#fff3e0' : '#f3e5f5'),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {event.type === 'chat' ? '💬' : (event.type === 'appointment' ? '📅' : '📞')}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.85em', color: '#888' }}>{new Date(event.date).toLocaleString()}</div>
                                <div style={{ fontWeight: 'bold' }}>{event.title}</div>
                                <div style={{ color: '#444', marginTop: '4px' }}>{event.description}</div>
                            </div>
                        </div>
                    ))}
                    {timeline.length === 0 && <div style={{ color: '#888', fontStyle: 'italic' }}>No history found.</div>}
                </div>
            </div>

            {/* RIGHT COLUMN: Actions & Stats */}
            <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', height: 'fit-content' }}>
                <h3>Stats</h3>
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>Life Time Value</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#2e7d32' }}>${profile.stats.totalSpend}</div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>Total Visits</div>
                    <div style={{ fontSize: '1.2em' }}>{profile.stats.totalVisits}</div>
                </div>

                <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

                <h3>Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => setShowEmailModal(true)} style={{ padding: '10px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        📧 Send Email
                    </button>

                    {showEmailModal && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
                                <h3 style={{ marginTop: 0 }}>Send Email to {profile.name}</h3>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8em', color: '#666', marginBottom: '4px' }}>To:</label>
                                    <input
                                        type="text"
                                        value={profile.email}
                                        disabled
                                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', background: '#f5f5f5', color: '#555' }}
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Subject"
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                    style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                                <textarea
                                    placeholder="Message..."
                                    value={emailMessage}
                                    onChange={e => setEmailMessage(e.target.value)}
                                    style={{ width: '100%', height: '150px', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button onClick={() => setShowEmailModal(false)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                    <button
                                        onClick={handleSendEmail}
                                        disabled={sendingEmail || !emailSubject || !emailMessage}
                                        style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: sendingEmail ? 0.7 : 1 }}
                                    >
                                        {sendingEmail ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => {
                            if (confirm(`Are you sure you want to ${profile.isBlocked ? 'unblock' : 'block'} this user?`)) {
                                updateProfileCheck({ isBlocked: !profile.isBlocked });
                            }
                        }}
                        style={{ padding: '10px', background: profile.isBlocked ? '#4CAF50' : '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {profile.isBlocked ? '✅ Unblock User' : '🚫 Block User'}
                    </button>
                </div>
            </div>

        </div>
    );

};
