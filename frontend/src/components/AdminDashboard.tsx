import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

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

interface AppointmentStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
}

interface Appointment {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  staff_name?: string;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  status: string;
  created_at: string;
}

interface DailySchedule {
  start: string;
  end: string;
}

interface WeeklySchedule {
  monday: DailySchedule | null;
  tuesday: DailySchedule | null;
  wednesday: DailySchedule | null;
  thursday: DailySchedule | null;
  friday: DailySchedule | null;
  saturday: DailySchedule | null;
  sunday: DailySchedule | null;
}

interface Staff {
  id: string;
  name: string;
  email?: string;
  role: string;
  services?: string[];
  schedule?: WeeklySchedule;
  isActive: boolean;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
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

const AUTH_TOKEN_KEY = 'admin_auth_token';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ serverUrl }) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'callbacks' | 'staff' | 'services' | 'holidays'>('overview');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffForm, setStaffForm] = useState<{ name: string, email: string, role: string, services: string[], schedule?: WeeklySchedule }>({ name: '', email: '', role: 'staff', services: [] });
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', duration: 30, price: 0, isActive: true });
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', isClosed: true });
  const [callbackFilter, setCallbackFilter] = useState<string>('pending');
  const [appointmentFilter, setAppointmentFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Get stored auth token
  const getAuthToken = (): string | null => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  };

  // Store auth token
  const setAuthToken = (token: string): void => {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      // Ignore storage errors
    }
  };

  // Remove auth token
  const removeAuthToken = (): void => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  // Create fetch headers with auth token
  const getAuthHeaders = (): HeadersInit => {
    const token = getAuthToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Verify existing session on mount
  useEffect(() => {
    const verifySession = async () => {
      const token = getAuthToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const res = await fetch(`${serverUrl}/api/auth/verify`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setIsAuthenticated(data.valid);
        if (!data.valid) {
          removeAuthToken();
        }
      } catch {
        setIsAuthenticated(false);
        removeAuthToken();
      } finally {
        setAuthLoading(false);
      }
    };

    verifySession();
  }, [serverUrl]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        setAuthToken(data.token);
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch {
      setLoginError('Connection error. Please try again.');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(`${serverUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch {
        // Ignore logout errors
      }
    }
    removeAuthToken();
    setIsAuthenticated(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [activeTab, isAuthenticated]);

  // Auto-refresh overview stats every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'overview') return;

    const interval = setInterval(() => {
      refreshOverviewStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  // Update current date/time every second
  useEffect(() => {
    if (!isAuthenticated) return;

    const clockInterval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [isAuthenticated]);

  // Refresh only overview stats (without loading state)
  const refreshOverviewStats = async () => {
    const headers = getAuthHeaders();
    try {
      const [statsRes, aptStatsRes] = await Promise.all([
        fetch(`${serverUrl}/api/admin/dashboard`, { headers }),
        fetch(`${serverUrl}/api/appointments/stats`, { headers })
      ]);
      if (statsRes.status === 401) { handleLogout(); return; }
      if (statsRes.ok) setStats(await statsRes.json());
      if (aptStatsRes.ok) setAppointmentStats(await aptStatsRes.json());
    } catch {
      // Silently fail on background refresh
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const headers = getAuthHeaders();

    try {
      switch (activeTab) {
        case 'overview':
          const [statsRes, aptStatsRes] = await Promise.all([
            fetch(`${serverUrl}/api/admin/dashboard`, { headers }),
            fetch(`${serverUrl}/api/appointments/stats`, { headers })
          ]);
          if (statsRes.status === 401) { handleLogout(); return; }
          if (statsRes.ok) setStats(await statsRes.json());
          if (aptStatsRes.ok) setAppointmentStats(await aptStatsRes.json());
          break;
        case 'appointments':
          const dateRange = getDateRange(appointmentFilter);
          let aptsUrl = `${serverUrl}/api/admin/appointments`;
          if (dateRange) {
            aptsUrl += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
          }
          const aptsRes = await fetch(aptsUrl, { headers });
          if (aptsRes.status === 401) { handleLogout(); return; }
          if (aptsRes.ok) setAppointments(await aptsRes.json());
          break;
        case 'staff':
          const [staffRes, servicesRes] = await Promise.all([
            fetch(`${serverUrl}/api/admin/staff`, { headers }),
            fetch(`${serverUrl}/api/services`)
          ]);
          if (staffRes.status === 401) { handleLogout(); return; }
          if (staffRes.ok) setStaff(await staffRes.json());
          if (servicesRes.ok) setAvailableServices(await servicesRes.json());
          break;
        case 'services':
          const svcsRes = await fetch(`${serverUrl}/api/admin/services`, { headers });
          if (svcsRes.status === 401) { handleLogout(); return; }
          if (svcsRes.ok) setAvailableServices(await svcsRes.json());
          break;
        case 'holidays':
          const holidaysRes = await fetch(`${serverUrl}/api/admin/holidays`, { headers });
          if (holidaysRes.status === 401) { handleLogout(); return; }
          if (holidaysRes.ok) setHolidays(await holidaysRes.json());
          break;

        case 'callbacks':
          const callbacksUrl = callbackFilter === 'all'
            ? `${serverUrl}/api/callbacks`
            : `${serverUrl}/api/callbacks?status=${callbackFilter}`;
          const callbacksRes = await fetch(callbacksUrl, { headers });
          if (callbacksRes.status === 401) { handleLogout(); return; }
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

  // Refetch appointments when filter changes
  useEffect(() => {
    if (activeTab === 'appointments') {
      fetchData();
    }
  }, [appointmentFilter]);

  // Helper to get date range based on filter
  const getDateRange = (filter: 'today' | 'week' | 'month' | 'all'): { startDate: string; endDate: string } | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Use local date format (YYYY-MM-DD) instead of toISOString which uses UTC
    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (filter) {
      case 'today':
        return { startDate: formatDateStr(today), endDate: formatDateStr(today) };
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        const weekAhead = new Date(today);
        weekAhead.setDate(today.getDate() + 7);
        return { startDate: formatDateStr(weekAgo), endDate: formatDateStr(weekAhead) };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        const monthAhead = new Date(today);
        monthAhead.setDate(today.getDate() + 30);
        return { startDate: formatDateStr(monthAgo), endDate: formatDateStr(monthAhead) };
      }
      case 'all':
        return null; // No date filtering
    }
  };

  const formatDate = (dateStr: string | Date) => {
    // Handle Date object from PostgreSQL or string
    let dateToFormat: Date;
    if (dateStr instanceof Date) {
      dateToFormat = dateStr;
    } else if (typeof dateStr === 'string') {
      // Check if it's an ISO date string or just YYYY-MM-DD
      dateToFormat = dateStr.includes('T')
        ? new Date(dateStr)
        : new Date(dateStr + 'T00:00:00');
    } else {
      return 'Invalid Date';
    }

    if (isNaN(dateToFormat.getTime())) {
      return 'Invalid Date';
    }

    return dateToFormat.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    // Handle HH:MM:SS or HH:MM format
    const timePart = time.split(':');
    const hours = parseInt(timePart[0], 10);
    const minutes = parseInt(timePart[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return time;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleUpdateAppointmentStatus = async (id: string, status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled') => {
    try {
      // Include timezone offset so server can correctly validate appointment time
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(`${serverUrl}/api/appointments/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, tz })
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        // Update local state directly to preserve scroll position
        setAppointments(prev => prev.map(apt =>
          apt.id === id ? { ...apt, status } : apt
        ));
        // Refresh all stats in background
        refreshOverviewStats();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update appointment status');
      }
    } catch {
      alert('Failed to update appointment status');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const url = editingStaffId
        ? `${serverUrl}/api/admin/staff/${editingStaffId}`
        : `${serverUrl}/api/admin/staff`;
      const method = editingStaffId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(staffForm)
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        const savedStaff = await res.json();
        setStaff(prev => editingStaffId
          ? prev.map(s => s.id === savedStaff.id ? savedStaff : s)
          : [...prev, savedStaff]
        );
        setShowStaffForm(false);
        setEditingStaffId(null);
        setStaffForm({ name: '', email: '', role: 'staff', services: [] });
      }
    } catch {
      alert('Failed to save staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaff = (staffMember: Staff) => {
    setStaffForm({
      name: staffMember.name,
      email: staffMember.email || '',
      role: staffMember.role,
      services: staffMember.services || [],
      schedule: staffMember.schedule
    });
    setEditingStaffId(staffMember.id);
    setShowStaffForm(true);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      const res = await fetch(`${serverUrl}/api/admin/staff/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        setStaff(prev => prev.filter(s => s.id !== id));
      }
    } catch {
      alert('Failed to delete staff');
    }
  };

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
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        const savedService = await res.json();
        setAvailableServices(prev => editingServiceId
          ? prev.map(s => s.id === savedService.id ? savedService : s)
          : [...prev, savedService]
        );
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
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        setAvailableServices(prev => prev.filter(s => s.id !== id));
      }
    } catch {
      alert('Failed to delete service');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${serverUrl}/api/admin/holidays`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(holidayForm)
      });
      if (res.status === 401) { handleLogout(); return; }
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
      const res = await fetch(`${serverUrl}/api/admin/holidays/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) fetchData();
    } catch {
      alert('Failed to delete holiday');
    }
  };



  const handleUpdateCallbackStatus = async (id: string, status: 'pending' | 'contacted' | 'completed' | 'no_answer', notes?: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/callbacks/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, notes })
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        // Update local state immediately for instant UI feedback
        setCallbacks(prev => prev.map(cb =>
          cb.id === id ? { ...cb, status, notes: notes ?? cb.notes } : cb
        ));
        // Backend now uses async, so cache is updated - no need to refetch
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
      if (res.status === 401) { handleLogout(); return; }
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">Checking authentication...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="admin-dashboard">
        <div className="admin-login">
          <div className="login-card">
            <h1>Admin Login</h1>
            <p>Enter your password to access the admin dashboard</p>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              {loginError && <div className="login-error">{loginError}</div>}
              <button type="submit" className="btn-primary">Login</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-content">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage appointments, staff, and settings</p>
          </div>
          <div className="header-datetime">
            <div className="datetime-date">
              {currentDateTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="datetime-time">
              {currentDateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })}
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        {(['overview', 'appointments', 'callbacks', 'staff', 'services', 'holidays'] as const).map(tab => (
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
          <>
            <div className="section-header">
              <h2>Overview</h2>
              <button className="btn-refresh" onClick={refreshOverviewStats} title="Refresh stats">
                ↻ Refresh
              </button>
            </div>

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

              {/* Appointment Status Stats */}
              {appointmentStats && (
                <>
                  {appointmentStats.pending > 0 && (
                    <div className="stat-card highlight">
                      <div className="stat-value">{appointmentStats.pending}</div>
                      <div className="stat-label">Pending Confirmation</div>
                    </div>
                  )}
                  <div className={`stat-card ${appointmentStats.noShowRate > 10 ? 'danger' : 'warning'}`}>
                    <div className="stat-value">{appointmentStats.noShow}</div>
                    <div className="stat-label">No-Shows (30d) - {appointmentStats.noShowRate}%</div>
                  </div>
                </>
              )}

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
          </>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && !loading && (
          <div className="appointments-list">
            <div className="section-header">
              <h2>Appointments</h2>
              <div style={{ display: 'flex', gap: '10px', marginRight: 'auto', marginLeft: '20px' }}>
                <button
                  className={`filter-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
                <button
                  className={`filter-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                  onClick={() => setViewMode('calendar')}
                >
                  Calendar
                </button>
              </div>
              <div className="date-filter-buttons">
                {(['today', 'week', 'month', 'all'] as const).map(filter => (
                  <button
                    key={filter}
                    className={`filter-btn ${appointmentFilter === filter ? 'active' : ''}`}
                    onClick={() => setAppointmentFilter(filter)}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <div style={{ height: '700px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <Calendar
                  localizer={localizer}
                  events={appointments.map(apt => {
                    const dateStr = String(apt.appointment_date).split('T')[0];
                    const start = new Date(`${dateStr}T${apt.appointment_time}`);
                    // Ensure duration is treated as number
                    const duration = Number(apt.duration) || 30;
                    const end = new Date(start.getTime() + duration * 60000);
                    return {
                      id: apt.id,
                      title: `${apt.customer_name} (${apt.service_name})`,
                      start,
                      end,
                      resource: apt,
                      status: apt.status
                    };
                  })}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  eventPropGetter={(event) => {
                    let backgroundColor = '#3174ad'; // confirmed/default
                    if (event.status === 'cancelled') backgroundColor = '#e74c3c';
                    if (event.status === 'pending') backgroundColor = '#f39c12';
                    if (event.status === 'completed') backgroundColor = '#27ae60';
                    if (event.status === 'no-show') backgroundColor = '#7f8c8d';
                    return { style: { backgroundColor } };
                  }}
                  onSelectEvent={(event) => {
                    alert(`Appointment Details:\n\nCustomer: ${event.resource.customer_name}\nService: ${event.resource.service_name}\nStaff: ${event.resource.staff_name || 'Unassigned'}\nTime: ${moment(event.start).format('h:mm A')} - ${moment(event.end).format('h:mm A')}\nStatus: ${event.status}`);
                  }}
                />
              </div>
            ) : appointments.length === 0 ? (
              <p className="no-data">No appointments found</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Staff</th>
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
                      <td>{apt.staff_name || '-'}</td>
                      <td>
                        <span className={`status-badge ${apt.status}`}>{apt.status}</span>
                      </td>
                      <td className="actions-cell">
                        {(() => {
                          // Check if appointment is in the future
                          // Handle both Date object and string - use typeof since appointment_date is typed as string
                          const dateVal = apt.appointment_date as unknown;
                          let aptDate: string;
                          if (typeof dateVal === 'object' && dateVal !== null && 'toISOString' in dateVal) {
                            aptDate = (dateVal as Date).toISOString().split('T')[0];
                          } else {
                            aptDate = String(apt.appointment_date).split('T')[0];
                          }
                          const aptDateTime = new Date(`${aptDate}T${apt.appointment_time}`);
                          const now = new Date();
                          const isFuture = aptDateTime > now;

                          // Future appointments: Only Cancel is available (for pending or confirmed)
                          if (isFuture && (apt.status === 'pending' || apt.status === 'confirmed')) {
                            return (
                              <button
                                className="btn-small danger"
                                onClick={() => handleUpdateAppointmentStatus(apt.id, 'cancelled')}
                              >
                                Cancel
                              </button>
                            );
                          }

                          // Past appointments: Only show actions if status is 'pending'
                          // Once confirmed, cancelled, or no-show - no more actions needed
                          if (!isFuture && apt.status === 'pending') {
                            return (
                              <>
                                <button
                                  className="btn-small success"
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'confirmed')}
                                >
                                  Confirm
                                </button>
                                <button
                                  className="btn-small danger"
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'cancelled')}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-small warning"
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'no-show')}
                                >
                                  No Show
                                </button>
                              </>
                            );
                          }

                          return null;
                        })()}
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
              <h2>{editingStaffId ? 'Edit Staff Member' : 'Staff Members'}</h2>
              <button className="btn-primary" onClick={() => {
                if (showStaffForm) {
                  setShowStaffForm(false);
                  setEditingStaffId(null);
                  setStaffForm({ name: '', email: '', role: 'staff', services: [] });
                } else {
                  setShowStaffForm(true);
                }
              }}>
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

                {/* Service selection */}
                {availableServices.length > 0 && (
                  <div className="service-checkboxes">
                    <label className="checkbox-group-label">Services this staff can provide:</label>
                    <div className="checkbox-group">
                      {availableServices.map(service => (
                        <label key={service.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={staffForm.services.includes(service.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setStaffForm({ ...staffForm, services: [...staffForm.services, service.id] });
                              } else {
                                setStaffForm({ ...staffForm, services: staffForm.services.filter(id => id !== service.id) });
                              }
                            }}
                          />
                          {service.name}
                        </label>
                      ))}
                    </div>
                    <small className="helper-text">Leave all unchecked if staff can provide all services</small>
                  </div>
                )}

                {/* Schedule Editor */}
                <div style={{ marginTop: '20px' }}>
                  <label className="checkbox-group-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Working Hours (Optional)</label>
                  <small className="helper-text" style={{ display: 'block', marginBottom: '15px' }}>Check days this staff member works. Unchecked days are considered OFF.</small>

                  <div className="schedule-grid">
                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => {
                      const currentSchedule = staffForm.schedule?.[day];
                      const isActive = !!currentSchedule;

                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <div style={{ width: '100px', fontWeight: 500 }}>{day.charAt(0).toUpperCase() + day.slice(1)}</div>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => {
                              let newSchedule = {
                                ...(staffForm.schedule || {
                                  monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null
                                })
                              };

                              if (e.target.checked) {
                                newSchedule[day] = { start: '09:00', end: '17:00' };
                              } else {
                                newSchedule[day] = null;
                              }
                              setStaffForm({ ...staffForm, schedule: newSchedule });
                            }}
                          />

                          {isActive && (
                            <>
                              <input
                                type="time"
                                value={currentSchedule.start}
                                onChange={(e) => {
                                  if (!staffForm.schedule) return;
                                  const newSchedule = { ...staffForm.schedule };
                                  if (newSchedule[day]) {
                                    newSchedule[day]!.start = e.target.value;
                                    setStaffForm({ ...staffForm, schedule: newSchedule });
                                  }
                                }}
                                style={{ width: '110px' }}
                              />
                              <span>to</span>
                              <input
                                type="time"
                                value={currentSchedule.end}
                                onChange={(e) => {
                                  if (!staffForm.schedule) return;
                                  const newSchedule = { ...staffForm.schedule };
                                  if (newSchedule[day]) {
                                    newSchedule[day]!.end = e.target.value;
                                    setStaffForm({ ...staffForm, schedule: newSchedule });
                                  }
                                }}
                                style={{ width: '110px' }}
                              />
                            </>
                          )}
                          {!isActive && <span style={{ color: '#888', fontStyle: 'italic' }}>Off</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" className="btn-primary">{editingStaffId ? 'Update Staff & Schedule' : 'Add Staff'}</button>
              </form>
            )}

            {staff.length === 0 ? (
              <p className="no-data">No staff members added yet</p>
            ) : (
              <div className="staff-grid">
                {staff.map(s => {
                  // Get service names for display
                  const serviceNames = s.services && s.services.length > 0
                    ? s.services.map(svcId => {
                      const svc = availableServices.find(sv => sv.id === svcId);
                      return svc ? svc.name : svcId;
                    })
                    : [];

                  return (
                    <div key={s.id} className={`staff-card ${!s.isActive ? 'inactive' : ''}`}>
                      <div className="staff-name">{s.name}</div>
                      <div className="staff-role">{s.role}</div>
                      {s.email && <div className="staff-email">{s.email}</div>}
                      {serviceNames.length > 0 ? (
                        <div className="staff-services">
                          <strong>Services:</strong> {serviceNames.join(', ')}
                        </div>
                      ) : (
                        <div className="staff-services all-services">All Services</div>
                      )}
                      {s.schedule ? (
                        <div className="staff-schedule" style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
                          <strong>Schedule: </strong>
                          <span style={{ color: '#2980b9' }}>Custom (Edit to view)</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85em', color: '#999', marginTop: '5px' }}>Schedule: Default Hours</div>
                      )}

                      <div className="card-actions" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-small"
                          onClick={() => handleEditStaff(s)}
                          style={{ backgroundColor: '#3498db', color: 'white', border: 'none' }}
                        >
                          Edit / Schedule
                        </button>
                        <button
                          className="btn-small danger"
                          onClick={() => handleDeleteStaff(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && !loading && (
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

            {availableServices.length === 0 ? (
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
                    {availableServices.map(service => (
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
