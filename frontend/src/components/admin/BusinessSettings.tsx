import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../hooks/useAuth';

interface BusinessSettingsProps {
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
}

interface BusinessInfo {
    name: string;
    description: string; // "Short catchphrase"
    phone: string;
    email: string;
    address: string;
    website: string;
}

export const BusinessSettings: React.FC<BusinessSettingsProps> = ({ serverUrl, getAuthHeaders }) => {
    const { logout } = useAuth();
    const [info, setInfo] = useState<BusinessInfo>({
        name: '',
        description: '',
        phone: '',
        email: '',
        address: '',
        website: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Fetch existing setting
    const { data: setting, mutate } = useSWR(
        `${serverUrl}/api/admin/settings/business`,
        async (url: string) => {
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.status === 404) return null; // Not set yet
            if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
            if (!res.ok) throw new Error('Failed to fetch business settings');
            return res.json();
        }
    );

    // Initialize state when data loads
    useEffect(() => {
        if (setting && setting.value) {
            setInfo({
                name: setting.value.name || '',
                description: setting.value.description || '',
                phone: setting.value.phone || '',
                email: setting.value.email || '',
                address: setting.value.address || '',
                website: setting.value.website || ''
            });
        }
    }, [setting]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus('idle');

        try {
            const res = await fetch(`${serverUrl}/api/admin/settings/business`, {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders() as Record<string, string>,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    value: info,
                    description: 'Core Business Profile (Name, Address, Contact)'
                })
            });

            if (res.status === 401) { logout(); return; }

            if (res.ok) {
                setSaveStatus('success');
                mutate();
                // Clear success message after 3 seconds
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error(error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="section-container">
            <div className="section-header">
                <h2>Business Profile</h2>
                <p className="subtitle">Core information used by the AI receptionist to identify your business.</p>
            </div>

            <form className="admin-form" onSubmit={handleSave} style={{ maxWidth: '600px' }}>
                <div className="form-group">
                    <label>Business Name</label>
                    <input
                        type="text"
                        value={info.name}
                        onChange={e => setInfo({ ...info, name: e.target.value })}
                        placeholder="e.g. Serenity Wellness Spa"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Description / Tagline</label>
                    <textarea
                        value={info.description}
                        onChange={e => setInfo({ ...info, description: e.target.value })}
                        placeholder="e.g. A premium wellness center offering therapeutic massage..."
                        rows={3}
                    />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label>Phone Number</label>
                        <input
                            type="text"
                            value={info.phone}
                            onChange={e => setInfo({ ...info, phone: e.target.value })}
                            placeholder="+1 (555) ..."
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={info.email}
                            onChange={e => setInfo({ ...info, email: e.target.value })}
                            placeholder="hello@business.com"
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Physical Address</label>
                    <input
                        type="text"
                        value={info.address}
                        onChange={e => setInfo({ ...info, address: e.target.value })}
                        placeholder="Street, City, State, Zip"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Website URL (Optional)</label>
                    <input
                        type="url"
                        value={info.website}
                        onChange={e => setInfo({ ...info, website: e.target.value })}
                        placeholder="https://..."
                    />
                </div>

                <div className="form-actions" style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Business Profile'}
                    </button>

                    {saveStatus === 'success' && (
                        <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>✅ Saved successfully!</span>
                    )}
                    {saveStatus === 'error' && (
                        <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>❌ Failed to save.</span>
                    )}
                </div>
            </form>
        </div>
    );
};
