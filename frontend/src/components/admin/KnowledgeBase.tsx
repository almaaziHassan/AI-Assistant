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
