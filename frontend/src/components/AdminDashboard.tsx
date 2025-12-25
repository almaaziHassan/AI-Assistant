import React, { useState, useEffect } from 'react';

interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  monthAppointments: number;
  totalRevenue: number;
  cancelledCount: number;
  upcomingCount: number;
  waitlistCount: number;
  pendingCallbacksCount: number;
  topServices: { serviceId: string; serviceName: string; count: number }[];
}

interface Appointment {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  created_at: string;
}

interface Staff {
  id: string;
  name: string;
  email?: string;
  role: string;
  isActive: boolean;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  isClosed: boolean;
  customHoursOpen?: string;
  customHoursClose?: string;
}

interface WaitlistEntry {
  id: string;
  customerName: string;
  customerEmail: string;
  serviceId: string;
  preferredDate: string;
  status: string;
}

interface CallbackRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  preferredTime?: string;
  concerns?: string;
  status: 'pending' | 'contacted' | 'completed' | 'no_answer';
  notes?: string;
  calledAt?: string;
  createdAt: string;
}

interface AdminDashboardProps {
  serverUrl: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ serverUrl }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'callbacks' | 'staff' | 'holidays' | 'waitlist'>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'staff' });
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', isClosed: true });
  const [callbackFilter, setCallbackFilter] = useState<string>('pending');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (activeTab) {
        case 'overview':
          const statsRes = await fetch(`${serverUrl}/api/admin/dashboard`);
          if (statsRes.ok) setStats(await statsRes.json());
          break;
        case 'appointments':
          const aptsRes = await fetch(`${serverUrl}/api/admin/appointments?limit=50`);
          if (aptsRes.ok) setAppointments(await aptsRes.json());
          break;
        case 'staff':
          const staffRes = await fetch(`${serverUrl}/api/admin/staff`);
          if (staffRes.ok) setStaff(await staffRes.json());
          break;
        case 'holidays':
          const holidaysRes = await fetch(`${serverUrl}/api/admin/holidays`);
          if (holidaysRes.ok) setHolidays(await holidaysRes.json());
          break;
        case 'waitlist':
          const waitlistRes = await fetch(`${serverUrl}/api/admin/waitlist?status=waiting`);
          if (waitlistRes.ok) setWaitlist(await waitlistRes.json());
          break;
        case 'callbacks':
          const callbacksUrl = callbackFilter === 'all'
            ? `${serverUrl}/api/callbacks`
            : `${serverUrl}/api/callbacks?status=${callbackFilter}`;
          const callbacksRes = await fetch(callbacksUrl);
          if (callbacksRes.ok) setCallbacks(await callbacksRes.json());
          break;
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Refetch callbacks when filter changes
  useEffect(() => {
    if (activeTab === 'callbacks') {
      fetchData();
    }
  }, [callbackFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const res = await fetch(`${serverUrl}/api/admin/appointments/${id}/cancel`, { method: 'PUT' });
      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to cancel appointment');
      }
    } catch {
      alert('Failed to cancel appointment');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${serverUrl}/api/admin/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm)
      });
      if (res.ok) {
        setShowStaffForm(false);
        setStaffForm({ name: '', email: '', role: 'staff' });
        fetchData();
      }
    } catch {
      alert('Failed to add staff');
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      const res = await fetch(`${serverUrl}/api/admin/staff/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {
      alert('Failed to delete staff');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${serverUrl}/api/admin/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayForm)
      });
      if (res.ok) {
        setShowHolidayForm(false);
        setHolidayForm({ date: '', name: '', isClosed: true });
        fetchData();
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
      const res = await fetch(`${serverUrl}/api/admin/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {
      alert('Failed to delete holiday');
    }
  };

  const handleRemoveFromWaitlist = async (id: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/admin/waitlist/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {
      alert('Failed to remove from waitlist');
    }
  };

  const handleUpdateCallbackStatus = async (id: string, status: string, notes?: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/callbacks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (res.ok) {
        fetchData();
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
      const res = await fetch(`${serverUrl}/api/callbacks/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {
      alert('Failed to delete callback');
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getPreferredTimeLabel = (time: string | undefined) => {
    const labels: Record<string, string> = {
      'morning': 'Morning (9am-12pm)',
      'afternoon': 'Afternoon (12pm-5pm)',
      'evening': 'Evening (5pm-8pm)',
      'anytime': 'Anytime'
    };
    return time ? labels[time] || time : 'Not specified';
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Manage appointments, staff, and settings</p>
      </header>

      <nav className="admin-tabs">
        {(['overview', 'appointments', 'callbacks', 'staff', 'holidays', 'waitlist'] as const).map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'callbacks' && callbacks.filter(c => c.status === 'pending').length > 0 && (
              <span className="tab-badge">{callbacks.filter(c => c.status === 'pending').length}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="admin-content">
        {loading && <div className="admin-loading">Loading...</div>}
        {error && <div className="admin-error">{error}</div>}

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && !loading && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.todayAppointments}</div>
              <div className="stat-label">Today's Appointments</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.weekAppointments}</div>
              <div className="stat-label">This Week</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.monthAppointments}</div>
              <div className="stat-label">This Month</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.upcomingCount}</div>
              <div className="stat-label">Upcoming</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-value">{stats.cancelledCount}</div>
              <div className="stat-label">Cancelled (30d)</div>
            </div>
            <div className="stat-card info">
              <div className="stat-value">{stats.waitlistCount}</div>
              <div className="stat-label">On Waitlist</div>
            </div>
            <div className="stat-card highlight">
              <div className="stat-value">{stats.pendingCallbacksCount}</div>
              <div className="stat-label">Pending Callbacks</div>
            </div>

            {stats.topServices.length > 0 && (
              <div className="stat-card wide">
                <div className="stat-label">Top Services (30d)</div>
                <div className="top-services">
                  {stats.topServices.map((s, i) => (
                    <div key={s.serviceId} className="service-stat">
                      <span className="service-rank">#{i + 1}</span>
                      <span className="service-name">{s.serviceName}</span>
                      <span className="service-count">{s.count} bookings</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && !loading && (
          <div className="appointments-list">
            <h2>Recent Appointments</h2>
            {appointments.length === 0 ? (
              <p className="no-data">No appointments found</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(apt => (
                    <tr key={apt.id} className={apt.status === 'cancelled' ? 'cancelled' : ''}>
                      <td>{formatDate(apt.appointment_date)}</td>
                      <td>{formatTime(apt.appointment_time)}</td>
                      <td>
                        <div>{apt.customer_name}</div>
                        <div className="sub-text">{apt.customer_email}</div>
                      </td>
                      <td>{apt.service_name}</td>
                      <td>
                        <span className={`status-badge ${apt.status}`}>{apt.status}</span>
                      </td>
                      <td>
                        {apt.status === 'confirmed' && (
                          <button
                            className="btn-small danger"
                            onClick={() => handleCancelAppointment(apt.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && !loading && (
          <div className="staff-section">
            <div className="section-header">
              <h2>Staff Members</h2>
              <button className="btn-primary" onClick={() => setShowStaffForm(!showStaffForm)}>
                {showStaffForm ? 'Cancel' : '+ Add Staff'}
              </button>
            </div>

            {showStaffForm && (
              <form className="admin-form" onSubmit={handleAddStaff}>
                <input
                  type="text"
                  placeholder="Name"
                  value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  required
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={staffForm.email}
                  onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                />
                <select
                  value={staffForm.role}
                  onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="btn-primary">Add Staff</button>
              </form>
            )}

            {staff.length === 0 ? (
              <p className="no-data">No staff members added yet</p>
            ) : (
              <div className="staff-grid">
                {staff.map(s => (
                  <div key={s.id} className={`staff-card ${!s.isActive ? 'inactive' : ''}`}>
                    <div className="staff-name">{s.name}</div>
                    <div className="staff-role">{s.role}</div>
                    {s.email && <div className="staff-email">{s.email}</div>}
                    <button
                      className="btn-small danger"
                      onClick={() => handleDeleteStaff(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Holidays Tab */}
        {activeTab === 'holidays' && !loading && (
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
        )}

        {/* Waitlist Tab */}
        {activeTab === 'waitlist' && !loading && (
          <div className="waitlist-section">
            <h2>Waitlist</h2>
            {waitlist.length === 0 ? (
              <p className="no-data">No one on the waitlist</p>
            ) : (
              <div className="waitlist-list">
                {waitlist.map(w => (
                  <div key={w.id} className="waitlist-card">
                    <div className="waitlist-customer">{w.customerName}</div>
                    <div className="waitlist-email">{w.customerEmail}</div>
                    <div className="waitlist-date">Preferred: {formatDate(w.preferredDate)}</div>
                    <button
                      className="btn-small"
                      onClick={() => handleRemoveFromWaitlist(w.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Callbacks Tab */}
        {activeTab === 'callbacks' && !loading && (
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

            {callbacks.length === 0 ? (
              <p className="no-data">No callback requests {callbackFilter !== 'all' ? `with status "${callbackFilter}"` : ''}</p>
            ) : (
              <div className="callbacks-list">
                {callbacks.map(cb => (
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
                      {cb.status === 'no_answer' && (
                        <button
                          className="btn-small"
                          onClick={() => handleUpdateCallbackStatus(cb.id, 'pending')}
                        >
                          Retry
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
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
