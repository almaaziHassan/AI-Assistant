import React, { useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AdminLogin } from './admin/Login';
import { Overview } from './admin/Overview';
import { Appointments } from './admin/Appointments';
import { StaffManager } from './admin/StaffManager';
import { ServicesManager } from './admin/ServicesManager';
import { HolidaysManager } from './admin/HolidaysManager';
import { CallbacksManager } from './admin/CallbacksManager';
import { KnowledgeBase } from './admin/KnowledgeBase';
import Clock from './admin/Clock';
import { TableSkeleton, StatsSkeleton } from './admin/Skeleton';
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

  const { mutate: globalMutate } = useSWRConfig();

  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'callbacks' | 'staff' | 'services' | 'holidays' | 'knowledge'>('overview');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [appointmentFilter, setAppointmentFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // --- Helpers ---

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

  // --- SWR Fetcher ---
  const fetcher = useCallback(async (url: string) => {
    const headers = getAuthHeaders();
    const res = await fetch(url, { headers });
    if (res.status === 401) {
      handleLogout();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Failed to fetch data');
      throw new Error(errorText || 'Failed to fetch data');
    }
    return res.json();
  }, [getAuthHeaders, handleLogout]);

  // --- SWR Hooks ---

  // Overview Data (Auto-refresh every 30s)
  const {
    data: stats,
    mutate: mutateStats,
    error: statsError
  } = useSWR<DashboardStats>(
    isAuthenticated && activeTab === 'overview' ? `${serverUrl}/api/admin/dashboard` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const {
    data: appointmentStats,
    mutate: mutateAptStats,
    error: aptStatsError
  } = useSWR<AppointmentStats>(
    isAuthenticated && activeTab === 'overview' ? `${serverUrl}/api/appointments/stats` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Appointments Data
  const dateRange = getDateRange(appointmentFilter);
  const appointmentsUrl = isAuthenticated && activeTab === 'appointments'
    ? `${serverUrl}/api/admin/appointments` + (dateRange ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}` : '')
    : null;

  const {
    data: appointments = [],
    mutate: mutateAppointments,
    error: appointmentsError,
    isLoading: appointmentsLoading
  } = useSWR<Appointment[]>(
    appointmentsUrl,
    fetcher
  );

  // Staff Data
  const {
    data: staff = [],
    mutate: mutateStaff,
    error: staffError,
    isLoading: staffLoading
  } = useSWR<Staff[]>(
    isAuthenticated && activeTab === 'staff' ? `${serverUrl}/api/admin/staff` : null,
    fetcher
  );

  // Public Services (for Staff tab forms)
  const {
    data: publicServices = []
  } = useSWR<Service[]>(
    isAuthenticated && activeTab === 'staff' ? `${serverUrl}/api/services` : null,
    fetcher
  );

  // Admin Services Data (for Services Manager)
  const {
    data: adminServices = [],
    mutate: mutateServices,
    error: servicesError,
    isLoading: servicesLoading
  } = useSWR<Service[]>(
    isAuthenticated && activeTab === 'services' ? `${serverUrl}/api/admin/services` : null,
    fetcher
  );

  // Holidays Data
  const {
    data: holidays = [],
    mutate: mutateHolidays,
    error: holidaysError,
    isLoading: holidaysLoading
  } = useSWR<Holiday[]>(
    isAuthenticated && activeTab === 'holidays' ? `${serverUrl}/api/admin/holidays` : null,
    fetcher
  );

  // Callbacks Data (Fetch always if authenticated to show badge counts)
  const {
    data: callbacks = [],
    mutate: mutateCallbacks,
    error: callbacksError,
    isLoading: callbacksLoading
  } = useSWR<CallbackRequest[]>(
    isAuthenticated ? `${serverUrl}/api/callbacks` : null,
    fetcher
  );

  // --- Handlers ---

  const refreshOverviewStats = async () => {
    await Promise.all([mutateStats(), mutateAptStats()]);
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
        // Revalidate appointments list
        mutateAppointments();
        // Also invalidate overview stats if they are cached
        globalMutate(`${serverUrl}/api/admin/dashboard`);
        globalMutate(`${serverUrl}/api/appointments/stats`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update appointment status');
      }
    } catch {
      alert('Failed to update appointment status');
    }
  };

  // Determine error state
  const error = statsError || aptStatsError || appointmentsError || staffError || servicesError || holidaysError || callbacksError;
  const errorMsg = error ? (error.message || 'Failed to load data') : null;

  // Determine loading state for Skeletons (true only if no data AND loading)
  // SWR keeps old data during revalidation, so !data check prevents skeleton flicker on tab switch
  const isOverviewLoading = activeTab === 'overview' && (!stats || !appointmentStats) && !error;
  const isTableLoading = (() => {
    switch (activeTab) {
      case 'appointments': return appointmentsLoading && appointments.length === 0;
      case 'staff': return staffLoading && staff.length === 0;
      case 'services': return servicesLoading && adminServices.length === 0;
      case 'holidays': return holidaysLoading && holidays.length === 0;
      case 'callbacks': return callbacksLoading && callbacks.length === 0;
      default: return false;
    }
  })();


  // --- Render ---

  if (authLoading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">Checking authentication...</div>
      </div>
    );
  }

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
        {(['overview', 'appointments', 'callbacks', 'staff', 'services', 'holidays', 'knowledge'] as const).map(tab => (
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
        {errorMsg && <div className="admin-error">{errorMsg}</div>}

        {/* Show skeleton loaders */}
        {isOverviewLoading && <StatsSkeleton />}
        {isTableLoading && <TableSkeleton rows={6} cols={5} />}

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && !isOverviewLoading && (
          <Overview
            stats={stats}
            appointmentStats={appointmentStats || null}
            onRefresh={refreshOverviewStats}
          />
        )}

        {/* Appointments Tab */}
        {
          activeTab === 'appointments' && !isTableLoading && (
            <Appointments
              appointments={appointments}
              viewMode={viewMode}
              setViewMode={setViewMode}
              filter={appointmentFilter}
              setFilter={setAppointmentFilter}
              onUpdateStatus={handleUpdateAppointmentStatus}
            />
          )
        }

        {/* Staff Tab */}
        {
          activeTab === 'staff' && !isTableLoading && (
            <StaffManager
              staff={staff}
              availableServices={publicServices}
              serverUrl={serverUrl}
              getAuthHeaders={getAuthHeaders}
              onRefresh={() => mutateStaff()}
              onLogout={handleLogout}
            />
          )
        }

        {/* Services Tab */}
        {
          activeTab === 'services' && !isTableLoading && (
            <ServicesManager
              services={adminServices}
              serverUrl={serverUrl}
              getAuthHeaders={getAuthHeaders}
              onRefresh={() => mutateServices()}
              onLogout={handleLogout}
            />
          )
        }

        {/* Holidays Tab */}
        {
          activeTab === 'holidays' && !isTableLoading && (
            <HolidaysManager
              holidays={holidays}
              serverUrl={serverUrl}
              getAuthHeaders={getAuthHeaders}
              onRefresh={() => mutateHolidays()}
              onLogout={handleLogout}
            />
          )
        }

        {/* Knowledge Base Tab */}
        {
          activeTab === 'knowledge' && (
            <KnowledgeBase
              serverUrl={serverUrl}
              getAuthHeaders={getAuthHeaders}
            />
          )
        }

        {/* Callbacks Tab */}
        {
          activeTab === 'callbacks' && !isTableLoading && (
            <CallbacksManager
              callbacks={callbacks}
              serverUrl={serverUrl}
              getAuthHeaders={getAuthHeaders}
              onRefresh={() => mutateCallbacks()}
              onLogout={handleLogout}
            />
          )
        }
      </main >
    </div >
  );
};

export default AdminDashboard;
