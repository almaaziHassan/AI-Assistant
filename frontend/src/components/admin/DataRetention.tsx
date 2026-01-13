import React, { useState, useEffect } from 'react';

interface DataRetentionProps {
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
}

export const DataRetention: React.FC<DataRetentionProps> = ({ serverUrl, getAuthHeaders }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [retentionStatus, setRetentionStatus] = useState<any>(null);


    // Config State
    const [apptDays, setApptDays] = useState<number>(1095);
    const [callbackDays, setCallbackDays] = useState<number>(180);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Status
            const statusRes = await fetch(`${serverUrl}/api/admin/maintenance/status`, { headers: getAuthHeaders() });
            if (statusRes.ok) setRetentionStatus(await statusRes.json());

            // Fetch Settings
            const settingsRes = await fetch(`${serverUrl}/api/admin/settings`, { headers: getAuthHeaders() });
            if (settingsRes.ok) {
                const data = await settingsRes.json();

                const aDays = data.find((s: any) => s.key === 'retention_appointments_days')?.value;
                const cDays = data.find((s: any) => s.key === 'retention_callbacks_days')?.value;
                if (aDays) setApptDays(Number(aDays));
                if (cDays) setCallbackDays(Number(cDays));
            }
        } catch (error) {
            console.error('Failed to load retention data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            // Save Appointments Days
            await fetch(`${serverUrl}/api/admin/settings/retention_appointments_days`, {
                method: 'PUT',
                headers: { ...getAuthHeaders() as Record<string, string>, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: apptDays, description: 'Days to retain appointments' })
            });

            // Save Callbacks Days
            await fetch(`${serverUrl}/api/admin/settings/retention_callbacks_days`, {
                method: 'PUT',
                headers: { ...getAuthHeaders() as Record<string, string>, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: callbackDays, description: 'Days to retain callbacks' })
            });

            setSaveMessage('✅ Settings saved successfully!');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            setSaveMessage('❌ Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunCheck = async () => {
        const isPending = retentionStatus?.status === 'pending_approval';
        const confirmMsg = isPending
            ? 'Archives are already pending. Do you want to REGENERATE them? This will overwrite existing files.'
            : 'Run immediate check for expired data? This will generate archives if data is found.';

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`${serverUrl}/api/admin/maintenance/check`, {
                method: 'POST',
                headers: { ...getAuthHeaders() as Record<string, string>, 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: isPending })
            });
            if (res.ok) {
                alert('Check initiated. Reloading status...');
                fetchData();
            }
        } catch (e) { alert('Error running check'); }
    };

    if (isLoading) return <div className="admin-loading">Loading retention data...</div>;

    const isPending = retentionStatus?.status === 'pending_approval';

    return (
        <div className="admin-content">
            <div className="section-header">
                <h2>Data Retention & Archiving</h2>
                <p className="subtitle">Manage automated cleanup policies and safe deletion of old records.</p>
            </div>

            <div className="retention-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                {/* 1. Status Card */}
                <div className="card" style={{ padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>System Status</h3>
                        <span className={`status-badge ${isPending ? 'warning' : 'success'}`} style={{
                            padding: '4px 12px',
                            borderRadius: '16px',
                            background: isPending ? '#fef3c7' : '#d1fae5',
                            color: isPending ? '#92400e' : '#065f46',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}>
                            {isPending ? '⚠️ Action Required' : '✅ Active & Idle'}
                        </span>
                    </div>

                    <p style={{ color: '#666', marginBottom: '20px' }}>
                        The system checks for expired data every 24 hours.
                        {retentionStatus?.lastRun && ` Last check: ${new Date(retentionStatus.lastRun).toLocaleString()}`}
                    </p>

                    <div className="actions">
                        <button onClick={handleRunCheck} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}>
                            {isPending ? '🔄 Force Re-Check' : '🔄 Run Manual Check'}
                        </button>
                    </div>
                </div>

                {/* 2. Configuration Card */}
                <div className="card" style={{ padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3>Retention Policy</h3>
                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>Define how long to keep data before archiving.</p>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Appointment Retention (Days)</label>
                        <input
                            type="number"
                            value={apptDays}
                            onChange={e => setApptDays(Number(e.target.value))}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                        />
                        <span style={{ fontSize: '12px', color: '#888' }}>Default: 1095 (3 Years)</span>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Callback Retention (Days)</label>
                        <input
                            type="number"
                            value={callbackDays}
                            onChange={e => setCallbackDays(Number(e.target.value))}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                        />
                        <span style={{ fontSize: '12px', color: '#888' }}>Default: 180 (6 Months)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            className="btn-primary"
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            style={{ padding: '8px 24px' }}
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                        {saveMessage && <span style={{ fontSize: '14px' }}>{saveMessage}</span>}
                    </div>
                </div>

                {/* 3. Action Card (Visible when Pending) */}
                {isPending && (
                    <div className="card" style={{ padding: '24px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fcd34d', gridColumn: '1 / -1' }}>
                        <h3 style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📂 Archives Ready for Decision
                        </h3>
                        <p style={{ color: '#b45309', marginBottom: '20px' }}>
                            The system has compiled expired data.
                            <strong> {retentionStatus.stats.appointments} appointments</strong> and
                            <strong> {retentionStatus.stats.callbacks} callbacks</strong> are ready to be archived and deleted from the live database.
                        </p>

                        <div className="action-steps" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
                            <div className="step">
                                <span style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Step 1: Download</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {retentionStatus.archivePath && (
                                        <>
                                            <button className="btn-secondary" style={{ background: 'white', textAlign: 'left' }} onClick={() => {
                                                const headers = getAuthHeaders() as Record<string, string>;
                                                window.open(`${serverUrl}/api/admin/maintenance/export?token=${headers['Authorization']?.split(' ')[1]}`, '_blank');
                                            }}>
                                                ⬇️ Download (Default)
                                            </button>

                                            <button className="btn-secondary" style={{ background: 'white', textAlign: 'left', marginTop: '4px' }} onClick={async () => {
                                                try {
                                                    // @ts-ignore - File System Access API
                                                    if (!window.showDirectoryPicker) {
                                                        alert('Your browser does not support picking a folder. Please use the default download button.');
                                                        return;
                                                    }

                                                    // 1. Pick Folder
                                                    // @ts-ignore
                                                    const dirHandle = await window.showDirectoryPicker();

                                                    // 2. Fetch File
                                                    const headers = getAuthHeaders() as Record<string, string>;
                                                    const res = await fetch(`${serverUrl}/api/admin/maintenance/export?token=${headers['Authorization']?.split(' ')[1]}`);
                                                    if (!res.ok) throw new Error('Download failed');
                                                    const blob = await res.blob();

                                                    // 3. Save File to Folder
                                                    const fileName = `archive_${new Date().toISOString().split('T')[0]}.xlsx`;
                                                    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                                                    const writable = await fileHandle.createWritable();
                                                    await writable.write(blob);
                                                    await writable.close();

                                                    alert(`✅ Saved ${fileName} to chosen folder!`);

                                                } catch (err: any) {
                                                    if (err.name !== 'AbortError') {
                                                        console.error('Save to folder failed:', err);
                                                        alert('Failed to save to folder. See console for details.');
                                                    }
                                                }
                                            }}>
                                                📂 Export to Folder...
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="step">
                                <span style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#dc2626' }}>Step 2: Cleanup</span>
                                <button
                                    className="btn-danger"
                                    style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
                                    onClick={async () => {
                                        if (!confirm('Have you downloaded and verified the archives? This action will PERMANENTLY DELETE the data from the database.')) return;
                                        try {
                                            const res = await fetch(`${serverUrl}/api/admin/maintenance/prune`, {
                                                method: 'POST',
                                                headers: getAuthHeaders()
                                            });
                                            if (res.ok) {
                                                alert('Cleanup Successful! Database optimised.');
                                                fetchData();
                                            } else {
                                                alert('Cleanup failed.');
                                            }
                                        } catch { alert('Error running cleanup'); }
                                    }}
                                >
                                    🗑️ Confirm & Delete Permanently
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
