import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AdminLogin } from './admin/Login';
import { Overview } from './admin/Overview';
import { Appointments } from './admin/Appointments';
import { StaffManager } from './admin/StaffManager';
import { ServicesManager } from './admin/ServicesManager';
import { HolidaysManager } from './admin/HolidaysManager';
import { CallbacksManager } from './admin/CallbacksManager';
import Clock from './admin/Clock';
import {
  DashboardStats,
  AppointmentStats,
  Appointment,
  CallbackRequest,
  Staff,
  Service,
  Holiday
} from '../types/admin';

interface AdminDashboardProps {
  serverUrl: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ serverUrl }) => {
  const {
    isAuthenticated,
    authLoading,
    loginError,
    password,
    setPassword,
    handleLogin,
    handleLogout,
    getAuthHeaders
  } = useAdminAuth(serverUrl);

  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'callbacks' | 'staff' | 'services' | 'holidays'>('overview');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Data loading state
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [appointmentFilter, setAppointmentFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

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
    setDataLoading(true);
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
          const callbacksRes = await fetch(`${serverUrl}/api/callbacks`, { headers });
          if (callbacksRes.status === 401) { handleLogout(); return; }
          if (callbacksRes.ok) setCallbacks(await callbacksRes.json());
          break;
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setDataLoading(false);
    }
  };

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

  const handleUpdateAppointmentStatus = async (id: string, status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled') => {
    try {
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(`${serverUrl}/api/appointments/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, tz })
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        setAppointments(prev => prev.map(apt =>
          apt.id === id ? { ...apt, status } : apt
        ));
        refreshOverviewStats();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update appointment status');
      }
    } catch {
      alert('Failed to update appointment status');
    }
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
      <AdminLogin
        password={password}
        setPassword={setPassword}
        handleLogin={handleLogin}
        loading={authLoading}
        error={loginError}
      />
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
          <Clock />
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
        {dataLoading && <div className="admin-loading">Loading data...</div>}
        {error && <div className="admin-error">{error}</div>}

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && !dataLoading && (
          <Overview
            stats={stats}
            appointmentStats={appointmentStats}
            onRefresh={refreshOverviewStats}
          />
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && !dataLoading && (
          <Appointments
            appointments={appointments}
            viewMode={viewMode}
            setViewMode={setViewMode}
            filter={appointmentFilter}
            setFilter={setAppointmentFilter}
            onUpdateStatus={handleUpdateAppointmentStatus}
          />
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && !dataLoading && (
          <StaffManager
            staff={staff}
            availableServices={availableServices}
            serverUrl={serverUrl}
            getAuthHeaders={getAuthHeaders}
            onRefresh={fetchData}
            onLogout={handleLogout}
          />
        )}

        {/* Services Tab */}
        {activeTab === 'services' && !dataLoading && (
          <ServicesManager
            services={availableServices}
            serverUrl={serverUrl}
            getAuthHeaders={getAuthHeaders}
            onRefresh={fetchData}
            onLogout={handleLogout}
          />
        )}

        {/* Holidays Tab */}
        {activeTab === 'holidays' && !dataLoading && (
          <HolidaysManager
            holidays={holidays}
            serverUrl={serverUrl}
            getAuthHeaders={getAuthHeaders}
            onRefresh={fetchData}
            onLogout={handleLogout}
          />
        )}

        {/* Callbacks Tab */}
        {activeTab === 'callbacks' && !dataLoading && (
          <CallbacksManager
            callbacks={callbacks}
            serverUrl={serverUrl}
            getAuthHeaders={getAuthHeaders}
            onRefresh={fetchData}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
