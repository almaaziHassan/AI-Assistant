import React, { useState, useEffect } from 'react';
import { FAQ, SystemSetting } from '../../types/admin';
import { BusinessHoursModal } from './BusinessHoursModal';

interface KnowledgeBaseProps {
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
    serverUrl,
    getAuthHeaders,
}) => {
    const [activeTab, setActiveTab] = useState<'faqs' | 'settings' | 'docs'>('faqs');
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [docs, setDocs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // FAQ Form State
    const [showFaqForm, setShowFaqForm] = useState(false);
    const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
    const [faqForm, setFaqForm] = useState<{
        question: string;
        answer: string;
        keywords: string;
        displayOrder: number;
        isActive: boolean;
    }>({ question: '', answer: '', keywords: '', displayOrder: 0, isActive: true });

    // Docs Form State
    const [showDocForm, setShowDocForm] = useState(false);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [docForm, setDocForm] = useState<{
        title: string;
        content: string;
        tags: string;
    }>({ title: '', content: '', tags: '' });

    // Settings Editor State
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [settingValue, setSettingValue] = useState<string>(''); // JSON string
    const [showHoursModal, setShowHoursModal] = useState(false);
    const [retentionStatus, setRetentionStatus] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'faqs') {
                const res = await fetch(`${serverUrl}/api/admin/faqs`, { headers: getAuthHeaders() });
                if (res.ok) setFaqs(await res.json());
            } else if (activeTab === 'settings') {
                const res = await fetch(`${serverUrl}/api/admin/settings`, { headers: getAuthHeaders() });
                if (res.ok) setSettings(await res.json());

                // Fetch retention status
                const statusRes = await fetch(`${serverUrl}/api/admin/maintenance/status`, { headers: getAuthHeaders() });
                if (statusRes.ok) setRetentionStatus(await statusRes.json());
            } else if (activeTab === 'docs') {
                const res = await fetch(`${serverUrl}/api/admin/docs`, { headers: getAuthHeaders() });
                if (res.ok) setDocs(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setIsLoading(false);
        }
    };

    // FAQ Handlers
    const handleSaveFaq = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingFaqId ? `${serverUrl}/api/admin/faqs/${editingFaqId}` : `${serverUrl}/api/admin/faqs`;
            const method = editingFaqId ? 'PUT' : 'POST';

            const body = {
                ...faqForm,
                keywords: faqForm.keywords.split(',').map(k => k.trim()).filter(k => k)
            };

            const res = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowFaqForm(false);
                setEditingFaqId(null);
                setFaqForm({ question: '', answer: '', keywords: '', displayOrder: 0, isActive: true });
                fetchData();
            } else {
                alert('Failed to save FAQ');
            }
        } catch {
            alert('Error saving FAQ');
        }
    };

    const handleEditFaq = (faq: FAQ) => {
        setFaqForm({
            question: faq.question,
            answer: faq.answer,
            keywords: faq.keywords.join(', '),
            displayOrder: faq.displayOrder,
            isActive: faq.isActive
        });
        setEditingFaqId(faq.id);
        setShowFaqForm(true);
    };

    const handleDeleteFaq = async (id: string) => {
        if (!confirm('Delete this FAQ?')) return;
        try {
            await fetch(`${serverUrl}/api/admin/faqs/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            fetchData();
        } catch {
            alert('Error deleting FAQ');
        }
    };

    // Docs Handlers
    const handleSaveDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingDocId ? `${serverUrl}/api/admin/docs/${editingDocId}` : `${serverUrl}/api/admin/docs`;
            const method = editingDocId ? 'PUT' : 'POST';

            const body = {
                title: docForm.title,
                content: docForm.content,
                tags: docForm.tags.split(',').map(k => k.trim()).filter(k => k)
            };

            const res = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });

            const text = await res.text();

            if (res.ok) {
                setShowDocForm(false);
                setEditingDocId(null);
                setDocForm({ title: '', content: '', tags: '' });
                fetchData();
            } else {
                let errorMsg = res.statusText;
                try {
                    const json = JSON.parse(text);
                    if (json.error) errorMsg = json.error;
                } catch {
                    // response was not JSON, use text if short, else status
                    if (text && text.length < 200) errorMsg = text;
                }
                alert(`Failed to save document (${res.status}): ${errorMsg}`);
            }
        } catch (e: any) {
            alert(`Error saving document: ${e.message}`);
        }
    };

    const handleEditDoc = (doc: any) => {
        setDocForm({
            title: doc.title,
            content: doc.content,
            tags: (doc.tags || []).join(', ')
        });
        setEditingDocId(doc.id);
        setShowDocForm(true);
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm('Delete this Document?')) return;
        try {
            await fetch(`${serverUrl}/api/admin/docs/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            fetchData();
        } catch {
            alert('Error deleting document');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (!confirm(`Upload "${file.name}" to Knowledge Base?`)) {
            e.target.value = ''; // Reset input
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            // Get auth token manually to avoid Content-Type application/json
            const authHeaders = getAuthHeaders() as Record<string, string>;

            const res = await fetch(`${serverUrl}/api/admin/docs/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeaders['Authorization']
                },
                body: formData
            });

            if (res.ok) {
                alert('File uploaded and added to Knowledge Base!');
                fetchData();
            } else {
                const text = await res.text();
                let errorMsg = text;
                try {
                    const json = JSON.parse(text);
                    if (json.error) errorMsg = json.error;
                } catch { }
                alert(`Upload failed: ${errorMsg}`);
            }
        } catch (error: any) {
            alert(`Error uploading file: ${error.message}`);
        } finally {
            setIsLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    // Settings Handlers
    const handleEditSetting = (setting: SystemSetting) => {
        setEditingKey(setting.key);
        setSettingValue(JSON.stringify(setting.value, null, 2));
    };

    const handleSaveSetting = async () => {
        try {
            let parsedValue;
            try {
                // Handle primitive strings (like retention days) without JSON.parse if they are just numbers
                if (editingKey?.startsWith('retention_')) {
                    parsedValue = settingValue; // Store as string '1095'
                } else {
                    parsedValue = JSON.parse(settingValue);
                }
            } catch {
                alert('Invalid JSON format');
                return;
            }

            const res = await fetch(`${serverUrl}/api/admin/settings/${editingKey}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ value: parsedValue })
            });

            if (res.ok) {
                setEditingKey(null);
                setSettingValue('');
                fetchData();
            } else {
                alert('Failed to save setting');
            }
        } catch {
            alert('Error saving setting');
        }
    };

    return (
        <div className="admin-content">
            <div className="section-header">
                <h2>Knowledge Base</h2>
                <div className="admin-tabs">
                    <button
                        className={`admin-tab ${activeTab === 'faqs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('faqs')}
                    >
                        FAQs
                    </button>
                    <button
                        className={`admin-tab ${activeTab === 'docs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('docs')}
                    >
                        Documents (RAG)
                    </button>
                    <button
                        className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        System Settings
                    </button>
                </div>
            </div>

            {isLoading && <div className="loading-spinner">Loading...</div>}

            {!isLoading && activeTab === 'faqs' && (
                <div className="faqs-container">
                    <button
                        className="btn-primary"
                        style={{ marginBottom: '20px' }}
                        onClick={() => {
                            setEditingFaqId(null);
                            setFaqForm({ question: '', answer: '', keywords: '', displayOrder: 0, isActive: true });
                            setShowFaqForm(!showFaqForm);
                        }}
                    >
                        {showFaqForm ? 'Cancel' : '+ Add FAQ'}
                    </button>

                    {showFaqForm && (
                        <form className="admin-form" onSubmit={handleSaveFaq}>
                            <div className="form-group">
                                <label>Question</label>
                                <input
                                    value={faqForm.question}
                                    onChange={e => setFaqForm({ ...faqForm, question: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Answer</label>
                                <textarea
                                    value={faqForm.answer}
                                    onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                                    required
                                    rows={4}
                                />
                            </div>
                            <div className="form-group">
                                <label>Keywords (comma separated)</label>
                                <input
                                    value={faqForm.keywords}
                                    onChange={e => setFaqForm({ ...faqForm, keywords: e.target.value })}
                                    placeholder="pricing, hours, location"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Display Order</label>
                                    <input
                                        type="number"
                                        value={faqForm.displayOrder}
                                        onChange={e => setFaqForm({ ...faqForm, displayOrder: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group checkbox">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={faqForm.isActive}
                                            onChange={e => setFaqForm({ ...faqForm, isActive: e.target.checked })}
                                        />
                                        Active
                                    </label>
                                </div>
                            </div>
                            <button type="submit" className="btn-save">Save FAQ</button>
                        </form>
                    )}

                    <div className="items-list">
                        {faqs.map(faq => (
                            <div key={faq.id} className="item-card">
                                <div className="item-header">
                                    <h3>{faq.question}</h3>
                                    <div className="actions">
                                        <button onClick={() => handleEditFaq(faq)}>Edit</button>
                                        <button className="danger" onClick={() => handleDeleteFaq(faq.id)}>Delete</button>
                                    </div>
                                </div>
                                <p>{faq.answer}</p>
                                <div className="tags">
                                    {faq.keywords.map(k => <span key={k} className="tag">{k}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isLoading && activeTab === 'docs' && (
                <div className="docs-container">
                    <button
                        className="btn-primary"
                        style={{ marginBottom: '20px' }}
                        onClick={() => {
                            setEditingDocId(null);
                            setDocForm({ title: '', content: '', tags: '' });
                            setShowDocForm(!showDocForm);
                        }}
                    >
                        {showDocForm ? 'Cancel' : '+ Add Document'}
                    </button>

                    <div style={{ display: 'inline-block', marginLeft: '10px' }}>
                        <label className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}>
                            Upload File (PDF/TXT)
                            <input
                                type="file"
                                onChange={handleFileUpload}
                                accept=".pdf,.txt"
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    {showDocForm && (
                        <form className="admin-form" onSubmit={handleSaveDoc}>
                            <div className="form-group">
                                <label>Title</label>
                                <input
                                    value={docForm.title}
                                    onChange={e => setDocForm({ ...docForm, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Content (Markdown supported)</label>
                                <textarea
                                    value={docForm.content}
                                    onChange={e => setDocForm({ ...docForm, content: e.target.value })}
                                    required
                                    rows={10}
                                />
                            </div>
                            <div className="form-group">
                                <label>Tags (comma separated for search relevance)</label>
                                <input
                                    value={docForm.tags}
                                    onChange={e => setDocForm({ ...docForm, tags: e.target.value })}
                                    placeholder="policy, pricing, agreement"
                                />
                            </div>
                            <button type="submit" className="btn-save">Save Document</button>
                        </form>
                    )}

                    <div className="items-list">
                        {docs.map(doc => (
                            <div key={doc.id} className="item-card">
                                <div className="item-header">
                                    <h3>{doc.title}</h3>
                                    <div className="actions">
                                        <button onClick={() => handleEditDoc(doc)}>Edit</button>
                                        <button className="danger" onClick={() => handleDeleteDoc(doc.id)}>Delete</button>
                                    </div>
                                </div>
                                <div className="doc-preview" style={{ maxHeight: '100px', overflow: 'hidden', color: '#666' }}>
                                    {doc.content.slice(0, 150)}...
                                </div>
                                <div className="tags">
                                    {doc.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isLoading && activeTab === 'settings' && (
                <div className="settings-container">

                    {/* Retention Cleanup Notification */}
                    {retentionStatus && retentionStatus.status === 'pending_approval' && (
                        <div className="cleanup-notification" style={{
                            background: '#fff8e6',
                            border: '1px solid #fcd34d',
                            borderRadius: '8px',
                            padding: '16px',
                            marginBottom: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>⚠️</span>
                                <div>
                                    <h3 style={{ margin: 0, color: '#92400e' }}>Data Retention Cleanup Pending</h3>
                                    <p style={{ margin: '4px 0', color: '#b45309' }}>
                                        The system has identified expired data ready for archival.
                                        ({retentionStatus.stats.appointments} appointments, {retentionStatus.stats.callbacks} callbacks)
                                    </p>
                                </div>
                            </div>

                            <div className="actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    className="btn-primary"
                                    onClick={async () => {
                                        // Download Actions
                                        const headers = getAuthHeaders() as Record<string, string>;
                                        if (retentionStatus.filePaths.appointments) {
                                            window.open(`${serverUrl}/api/admin/maintenance/export?type=appointments&token=${headers['Authorization']?.split(' ')[1]}`, '_blank');
                                        }
                                        if (retentionStatus.filePaths.callbacks) {
                                            setTimeout(() => {
                                                window.open(`${serverUrl}/api/admin/maintenance/export?type=callbacks&token=${headers['Authorization']?.split(' ')[1]}`, '_blank');
                                            }, 1000);
                                        }
                                    }}
                                >
                                    ⬇️ Download Archives
                                </button>

                                <button
                                    className="btn-danger"
                                    style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                                    onClick={async () => {
                                        if (!confirm('Have you downloaded the archives? This action will PERMANENTLY DELETE the data.')) return;
                                        try {
                                            const res = await fetch(`${serverUrl}/api/admin/maintenance/prune`, {
                                                method: 'POST',
                                                headers: getAuthHeaders()
                                            });
                                            if (res.ok) {
                                                alert('Cleanup Complete!');
                                                fetchData();
                                            } else {
                                                alert('Cleanup failed.');
                                            }
                                        } catch { alert('Error running cleanup'); }
                                    }}
                                >
                                    🗑️ Confirm & Delete
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Business Hours Modal Integration */}
                    {showHoursModal && (
                        <BusinessHoursModal
                            isOpen={showHoursModal}
                            onClose={() => {
                                setShowHoursModal(false);
                                setEditingKey(null);
                            }}
                            initialHours={settings.find(s => s.key === 'hours')?.value || null}
                            onSave={async (newHours) => {
                                try {
                                    const res = await fetch(`${serverUrl}/api/admin/settings/hours`, {
                                        method: 'PUT',
                                        headers: {
                                            ...getAuthHeaders() as Record<string, string>,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({ value: newHours, description: 'General Office Hours' })
                                    });
                                    if (res.ok) {
                                        fetchData();
                                        setShowHoursModal(false);
                                        setEditingKey(null);
                                    } else {
                                        alert('Failed to save hours');
                                    }
                                } catch {
                                    alert('Error saving hours');
                                }
                            }}
                        />
                    )}

                    {editingKey && editingKey !== 'hours' ? (
                        <div className="admin-form settings-editor">
                            <div className="section-header">
                                <h3>Editing: {editingKey}</h3>
                                {editingKey !== 'receptionist' && editingKey !== 'appointmentSettings' && !editingKey.startsWith('retention_') && (
                                    <span className="status-badge pending">Advanced JSON Mode</span>
                                )}
                            </div>

                            {/* Specialized Form for Retention */}
                            {editingKey.startsWith('retention_') && (
                                <div className="specialized-form">
                                    <div className="form-group">
                                        <label>{editingKey === 'retention_appointments_days' ? 'Days to keep Appointments' : 'Days to keep Callbacks'}</label>
                                        <input
                                            type="number"
                                            value={settingValue} // It's just a number string in DB
                                            onChange={e => setSettingValue(e.target.value)}
                                        />
                                        <span className="helper-text">
                                            {editingKey === 'retention_appointments_days' ? 'Default: 1095 (3 Years)' : 'Default: 180 (6 Months)'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Specialized Form for Receptionist */}
                            {editingKey === 'receptionist' && (
                                <div className="specialized-form">
                                    <div className="form-group">
                                        <label>Receptionist Name</label>
                                        <input
                                            type="text"
                                            defaultValue={JSON.parse(settingValue).name}
                                            onChange={e => {
                                                const current = JSON.parse(settingValue);
                                                current.name = e.target.value;
                                                setSettingValue(JSON.stringify(current, null, 2));
                                            }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Persona / Tone</label>
                                        <input
                                            type="text"
                                            defaultValue={JSON.parse(settingValue).persona}
                                            onChange={e => {
                                                const current = JSON.parse(settingValue);
                                                current.persona = e.target.value;
                                                setSettingValue(JSON.stringify(current, null, 2));
                                            }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Greeting Message</label>
                                        <textarea
                                            rows={3}
                                            defaultValue={JSON.parse(settingValue).greeting}
                                            onChange={e => {
                                                const current = JSON.parse(settingValue);
                                                current.greeting = e.target.value;
                                                setSettingValue(JSON.stringify(current, null, 2));
                                            }}
                                        />
                                        <span className="helper-text">You can use {'{business_name}'} and {'{receptionist_name}'} placeholders.</span>
                                    </div>
                                </div>
                            )}

                            {/* Specialized Form for Appointment Settings */}
                            {editingKey === 'appointmentSettings' && (
                                <div className="specialized-form">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Slot Duration (min)</label>
                                            <input
                                                type="number"
                                                defaultValue={JSON.parse(settingValue).slotDuration}
                                                onChange={e => {
                                                    const current = JSON.parse(settingValue);
                                                    current.slotDuration = parseInt(e.target.value);
                                                    setSettingValue(JSON.stringify(current, null, 2));
                                                }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Buffer Between Appts (min)</label>
                                            <input
                                                type="number"
                                                defaultValue={JSON.parse(settingValue).bufferBetweenAppointments}
                                                onChange={e => {
                                                    const current = JSON.parse(settingValue);
                                                    current.bufferBetweenAppointments = parseInt(e.target.value);
                                                    setSettingValue(JSON.stringify(current, null, 2));
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Max Advance Booking (Days)</label>
                                        <input
                                            type="number"
                                            defaultValue={JSON.parse(settingValue).maxAdvanceBookingDays}
                                            onChange={e => {
                                                const current = JSON.parse(settingValue);
                                                current.maxAdvanceBookingDays = parseInt(e.target.value);
                                                setSettingValue(JSON.stringify(current, null, 2));
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Fallback JSON Editor */}
                            {editingKey !== 'receptionist' && editingKey !== 'appointmentSettings' && !editingKey.startsWith('retention_') && (
                                <div className="json-editor">
                                    <textarea
                                        value={settingValue}
                                        onChange={e => setSettingValue(e.target.value)}
                                        rows={15}
                                        style={{ fontFamily: 'monospace', width: '100%' }}
                                    />
                                </div>
                            )}

                            <div className="form-actions">
                                <button className="btn-save" onClick={handleSaveSetting}>Save Changes</button>
                                <button className="btn-secondary" onClick={() => setEditingKey(null)} style={{ marginLeft: '10px', padding: '10px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="items-list">
                            {settings.map(setting => (
                                <div key={setting.key} className="item-card">
                                    <div className="item-header">
                                        <h3>{setting.key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                                        <button className="btn-small" onClick={() => {
                                            if (setting.key === 'hours') {
                                                setEditingKey('hours'); // Mark as editing to hide list
                                                setShowHoursModal(true);
                                            } else {
                                                handleEditSetting(setting);
                                            }
                                        }}>
                                            Edit {setting.key === 'hours' || setting.key === 'receptionist' || setting.key === 'appointmentSettings' || setting.key.startsWith('retention_') ? '' : 'JSON'}
                                        </button>
                                    </div>
                                    <p className="description" style={{ color: '#6b7280', fontSize: '14px', marginBottom: '10px' }}>{setting.description}</p>
                                    <div className="preview">
                                        {setting.key === 'receptionist' ? (
                                            <div>
                                                <strong>Name:</strong> {setting.value.name}<br />
                                                <strong>Persona:</strong> {setting.value.persona}
                                            </div>
                                        ) : setting.key === 'appointmentSettings' ? (
                                            <div>
                                                Max Advance: {setting.value.maxAdvanceBookingDays} days | Slots: {setting.value.slotDuration} min
                                            </div>
                                        ) : setting.key === 'hours' ? (
                                            <div>
                                                Click "Edit" to manage Open/Close hours visually.
                                            </div>
                                        ) : setting.key.startsWith('retention_') ? (
                                            <div>
                                                {setting.value} Days
                                            </div>
                                        ) : (
                                            <pre style={{ margin: 0 }}>{JSON.stringify(setting.value, null, 2).slice(0, 150)}...</pre>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
