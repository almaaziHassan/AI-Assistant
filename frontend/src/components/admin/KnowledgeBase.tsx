import React, { useState, useEffect } from 'react';
import { FAQ, SystemSetting } from '../../types/admin';

interface KnowledgeBaseProps {
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
    serverUrl,
    getAuthHeaders,
}) => {
    const [activeTab, setActiveTab] = useState<'faqs' | 'settings'>('faqs');
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [settings, setSettings] = useState<SystemSetting[]>([]);
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

    // Settings Editor State
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [settingValue, setSettingValue] = useState<string>(''); // JSON string

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'faqs') {
                const res = await fetch(`${serverUrl}/api/admin/faqs`, { headers: getAuthHeaders() });
                if (res.ok) setFaqs(await res.json());
            } else {
                const res = await fetch(`${serverUrl}/api/admin/settings`, { headers: getAuthHeaders() });
                if (res.ok) setSettings(await res.json());
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

    // Settings Handlers
    const handleEditSetting = (setting: SystemSetting) => {
        setEditingKey(setting.key);
        setSettingValue(JSON.stringify(setting.value, null, 2));
    };

    const handleSaveSetting = async () => {
        try {
            let parsedValue;
            try {
                parsedValue = JSON.parse(settingValue);
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
        <div className="admin-section">
            <div className="section-header">
                <h2>Knowledge Base</h2>
                <div className="tabs">
                    <button
                        className={`tab-btn ${activeTab === 'faqs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('faqs')}
                    >
                        FAQs
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
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

            {!isLoading && activeTab === 'settings' && (
                <div className="settings-container">
                    {editingKey ? (
                        <div className="json-editor">
                            <h3>Editing: {editingKey}</h3>
                            <textarea
                                value={settingValue}
                                onChange={e => setSettingValue(e.target.value)}
                                rows={15}
                                style={{ fontFamily: 'monospace', width: '100%' }}
                            />
                            <div className="actions" style={{ marginTop: '10px' }}>
                                <button className="btn-save" onClick={handleSaveSetting}>Save JSON</button>
                                <button onClick={() => setEditingKey(null)} style={{ marginLeft: '10px' }}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="items-list">
                            {settings.map(setting => (
                                <div key={setting.key} className="item-card">
                                    <div className="item-header">
                                        <h3>{setting.key}</h3>
                                        <button onClick={() => handleEditSetting(setting)}>Edit JSON</button>
                                    </div>
                                    <p className="description">{setting.description}</p>
                                    <pre className="preview">{JSON.stringify(setting.value, null, 2).slice(0, 100)}...</pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
