import React, { useState } from 'react';
import { Service } from '../../types/admin';

interface ServicesManagerProps {
    services: Service[];
    serverUrl: string;
    getAuthHeaders: () => HeadersInit;
    onRefresh: () => void;
    onLogout: () => void;
}

export const ServicesManager: React.FC<ServicesManagerProps> = ({
    services,
    serverUrl,
    getAuthHeaders,
    onRefresh,
    onLogout
}) => {
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
    const [serviceForm, setServiceForm] = useState({
        name: '',
        description: '',
        duration: 30,
        price: 0,
        isActive: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const url = editingServiceId
                ? `${serverUrl}/api/admin/services/${editingServiceId}`
                : `${serverUrl}/api/admin/services`;
            const method = editingServiceId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(serviceForm)
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) {
                onRefresh();
                setShowServiceForm(false);
                setEditingServiceId(null);
                setServiceForm({ name: '', description: '', duration: 30, price: 0, isActive: true });
            }
        } catch {
            alert('Failed to save service');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditService = (service: Service) => {
        setServiceForm({
            name: service.name,
            description: service.description || '',
            duration: service.duration,
            price: service.price,
            isActive: service.isActive
        });
        setEditingServiceId(service.id);
        setShowServiceForm(true);
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm('Are you sure you want to delete this service?')) return;

        try {
            const res = await fetch(`${serverUrl}/api/admin/services/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.status === 401) { onLogout(); return; }
            if (res.ok) {
                onRefresh();
            }
        } catch {
            alert('Failed to delete service');
        }
    };

    return (
        <div className="services-section">
            <div className="section-header">
                <h2>{editingServiceId ? 'Edit Service' : 'Services'}</h2>
                <button className="btn-primary" onClick={() => {
                    if (showServiceForm) {
                        setShowServiceForm(false);
                        setEditingServiceId(null);
                        setServiceForm({ name: '', description: '', duration: 30, price: 0, isActive: true });
                    } else {
                        setShowServiceForm(true);
                    }
                }}>
                    {showServiceForm ? 'Cancel' : '+ Add Service'}
                </button>
            </div>

            {showServiceForm && (
                <form className="admin-form" onSubmit={handleAddService}>
                    <div className="form-group" style={{ width: '100%' }}>
                        <input
                            type="text"
                            placeholder="Service Name"
                            value={serviceForm.name}
                            onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                            required
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="form-group" style={{ width: '100%' }}>
                        <input
                            type="text"
                            placeholder="Description (optional)"
                            value={serviceForm.description}
                            onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="form-group">
                        <label>Duration (min):</label>
                        <input
                            type="number"
                            placeholder="Duration"
                            value={serviceForm.duration}
                            onChange={e => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) || 0 })}
                            required
                            min="5"
                        />
                    </div>
                    <div className="form-group">
                        <label>Price ($):</label>
                        <input
                            type="number"
                            placeholder="Price"
                            value={serviceForm.price}
                            onChange={e => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })}
                            required
                            min="0"
                        />
                    </div>
                    <button type="submit" className="btn-primary">{editingServiceId ? 'Update Service' : 'Add Service'}</button>
                </form>
            )}

            {services.length === 0 ? (
                <p className="no-data">No services added yet</p>
            ) : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Duration</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map(service => (
                                <tr key={service.id} className={!service.isActive ? 'cancelled' : ''}>
                                    <td>
                                        <div className="service-name">{service.name}</div>
                                        {service.description && <div className="sub-text">{service.description}</div>}
                                    </td>
                                    <td>{service.duration} min</td>
                                    <td>${service.price}</td>
                                    <td>
                                        <span className={`status-badge ${service.isActive ? 'confirmed' : 'cancelled'}`}>
                                            {service.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn-small"
                                                onClick={() => handleEditService(service)}
                                                style={{ backgroundColor: '#3498db', color: 'white', border: 'none' }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="btn-small danger"
                                                onClick={() => handleDeleteService(service.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
