import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDashboard from '../src/components/AdminDashboard';
import useSWR from 'swr';

// Mock SWR to avoid "Invalid hook call" and control data state
const mockUseSWR = vi.fn();
vi.mock('swr', () => ({
  default: (key: any, fetcher: any) => mockUseSWR(key, fetcher),
  useSWRConfig: () => ({ mutate: vi.fn() })
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('AdminDashboard', () => {
  const serverUrl = 'http://localhost:3000';

  // Default mock data for fallback
  const defaultMockStats = {
    todayAppointments: 0,
    weekAppointments: 0,
    monthAppointments: 0,
    totalRevenue: 0,
    cancelledCount: 0,
    upcomingCount: 0,
    waitlistCount: 0,
    pendingCallbacksCount: 0,
    topServices: []
  };

  const defaultAppointmentStats = {
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    noShowRate: 0
  };

  const setupMockData = (
    dashboard: any = defaultMockStats,
    actionRequired: any[] = [],
    apptStats: any = defaultAppointmentStats,
    appointments: any[] = []
  ) => {
    mockUseSWR.mockImplementation((key: string) => {
      if (!key) return { data: undefined, error: undefined, isLoading: false };

      if (key.includes('/api/auth/verify')) return { data: undefined, isLoading: false }; // Handled by fetch

      if (key.includes('/api/admin/dashboard')) return { data: dashboard, error: undefined, isLoading: false };
      if (key.includes('/api/admin/action-required')) return { data: actionRequired, error: undefined, isLoading: false };
      if (key.includes('/api/appointments/stats')) return { data: apptStats, error: undefined, isLoading: false };
      if (key.includes('/api/admin/appointments')) return { data: appointments, error: undefined, isLoading: false };

      return { data: undefined, error: undefined, isLoading: false };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Set up a default implementation that returns safe fallback values
    // This prevents "appointments.map is not a function" errors when mocks run out
    // Default SWR Mock Implementation
    mockUseSWR.mockImplementation((key: string) => {
      if (!key) return { data: undefined, error: undefined, isLoading: false };

      if (key.includes('/api/auth/verify')) {
        // Auth verify must return valid by default if we want dashboard to render
        // But tests override this. Let's return valid: true to match most tests
        // Actually, most tests mock mockFetch for verify. 
        // AdminDashboard DOES NOT use SWR for auth/verify. It uses fetch in useEffect!
        // So we don't mock this for SWR.
        return { data: undefined, isLoading: false };
      }

      if (key.includes('/api/admin/dashboard')) {
        return { data: defaultMockStats, error: undefined, isLoading: false };
      }
      if (key.includes('/api/admin/appointments')) {
        // Appointments list
        return { data: [], error: undefined, isLoading: false };
      }
      if (key.includes('/api/appointments/stats')) {
        return { data: defaultAppointmentStats, error: undefined, isLoading: false };
      }
      if (key.includes('/api/admin/action-required')) {
        return { data: [], error: undefined, isLoading: false };
      }

      return { data: undefined, error: undefined, isLoading: false };
    });

    // Mock fetch for non-SWR calls (auth, updates)
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/auth')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ valid: true }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  describe('Authentication', () => {
    const mockDashboardStats = {
      todayAppointments: 5,
      weekAppointments: 20,
      monthAppointments: 80,
      totalRevenue: 5000,
      cancelledCount: 3,
      upcomingCount: 15,
      waitlistCount: 2,
      pendingCallbacksCount: 4,
      topServices: []
    };

    const mockAppointmentStats = {
      total: 100,
      pending: 10,
      confirmed: 20,
      completed: 70,
      cancelled: 5,
      noShow: 5,
      noShowRate: 7
    };

    it('should show login form when not authenticated', async () => {
      // No token in localStorage
      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Admin Login')).toBeInTheDocument();
      });
      expect(screen.getByPlaceholderText('Enter admin password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    });

    it('should show loading state while checking auth', () => {
      localStorageMock.getItem.mockReturnValue('some-token');
      mockFetch.mockImplementation(() => new Promise(() => { })); // Never resolves

      render(<AdminDashboard serverUrl={serverUrl} />);

      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    });

    it('should verify existing token on mount', async () => {
      const existingToken = 'existing-valid-token';
      localStorageMock.getItem.mockReturnValue(existingToken);

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockDashboardStats, [], mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/auth/verify`,
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${existingToken}`
            })
          })
        );
      });
    });

    it('should redirect to login when token is invalid', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ valid: false })
      });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Admin Login')).toBeInTheDocument();
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('admin_auth_token');
    });

    it('should login successfully with correct password', async () => {
      const user = userEvent.setup();
      const token = 'new-auth-token';

      // Initial state: no token
      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Admin Login')).toBeInTheDocument();
      });

      // Mock login response
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, token }) });
      setupMockData(mockDashboardStats, [], mockAppointmentStats);

      // Fill in password and submit
      const passwordInput = screen.getByPlaceholderText('Enter admin password');
      await user.type(passwordInput, 'admin123');

      const loginButton = screen.getByRole('button', { name: 'Login' });
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/auth/login`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ password: 'admin123' })
          })
        );
      });

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('admin_auth_token', token);
      });
    });

    it('should show error for incorrect password', async () => {
      const user = userEvent.setup();

      // Initial state: no token
      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Admin Login')).toBeInTheDocument();
      });

      // Mock failed login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid password' })
      });

      const passwordInput = screen.getByPlaceholderText('Enter admin password');
      await user.type(passwordInput, 'wrongpassword');

      const loginButton = screen.getByRole('button', { name: 'Login' });
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument();
      });
    });

    it('should show logout button when authenticated', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockDashboardStats, [], mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should logout when logout button is clicked', async () => {
      const user = userEvent.setup();
      const token = 'valid-token';
      localStorageMock.getItem.mockReturnValue(token);

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockDashboardStats, [], mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Mock logout
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

      const logoutButton = screen.getByText('Logout');
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/auth/logout`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${token}`
            })
          })
        );
      });

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('admin_auth_token');
      });
    });


  });

  describe('Overview Tab', () => {
    const mockStats = {
      todayAppointments: 5,
      weekAppointments: 20,
      monthAppointments: 80,
      totalRevenue: 5000,
      cancelledCount: 3,
      upcomingCount: 15,
      waitlistCount: 2,
      pendingCallbacksCount: 4,
      topServices: [
        { serviceId: '1', serviceName: 'Swedish Massage', count: 10 }
      ]
    };

    const mockAppointmentStats = {
      total: 100,
      pending: 10,
      confirmed: 20,
      completed: 70,
      cancelled: 5,
      noShow: 5,
      noShowRate: 7
    };

    const mockActionRequired: never[] = [];

    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('valid-token');
    });

    it('should render stats cards', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, mockActionRequired, mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText("Today's Confirmed")).toBeInTheDocument();
      });

      expect(screen.getByText('This Week (Confirmed)')).toBeInTheDocument();
      expect(screen.getByText('This Month (Confirmed)')).toBeInTheDocument();
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });



    it('should show no-show count and rate', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, mockActionRequired, mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('No-Shows (30d)')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });
  });



  describe('Appointments Tab', () => {
    const mockStats = {
      todayAppointments: 5,
      weekAppointments: 20,
      monthAppointments: 80,
      totalRevenue: 5000,
      cancelledCount: 3,
      upcomingCount: 15,
      waitlistCount: 2,
      pendingCallbacksCount: 4,
      topServices: []
    };

    const mockAppointmentStats = {
      total: 100,
      pending: 10,
      confirmed: 20,
      completed: 70,
      cancelled: 5,
      noShow: 5,
      noShowRate: 7
    };

    const mockPendingAppointment = {
      id: 'apt-pending-1',
      customer_name: 'Pending Customer',
      customer_email: 'pending@test.com',
      customer_phone: '+14155551234',
      service_name: 'Consultation',
      appointment_date: '2025-12-28',
      appointment_time: '10:00',
      status: 'pending',
      created_at: '2025-12-27T10:00:00Z'
    };

    const mockConfirmedAppointment = {
      id: 'apt-confirmed-1',
      customer_name: 'Confirmed Customer',
      customer_email: 'confirmed@test.com',
      customer_phone: '+14155551234',
      service_name: 'Swedish Massage',
      appointment_date: '2025-12-28',
      appointment_time: '11:00',
      status: 'confirmed',
      created_at: '2025-12-27T10:00:00Z'
    };

    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('valid-token');
    });

    it('should show three action buttons (Confirm, Cancel, No-Show) for pending appointments', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats, [mockPendingAppointment]);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Click on Appointments tab
      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('Pending Customer')).toBeInTheDocument();
      });

      // Check for three action buttons for pending appointment
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('No-Show')).toBeInTheDocument();
    });

    it('should show pending status badge for pending appointments', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats, [mockPendingAppointment]);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        const statusBadge = screen.getByText('pending');
        expect(statusBadge).toHaveClass('status-badge');
        expect(statusBadge).toHaveClass('pending');
      });
    });

    it('should call confirm API when clicking Confirm button', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats, [mockPendingAppointment]);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });

      // Mock the status update API
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });


      const confirmButton = screen.getByText('Confirm');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/${mockPendingAppointment.id}/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"status":"confirmed"')
          })
        );
      });
    });

    it('should call cancel API when clicking Cancel button', async () => {
      const user = userEvent.setup();


      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats, [mockPendingAppointment]);
      localStorageMock.getItem.mockReturnValue('valid-token');

      render(<AdminDashboard serverUrl={serverUrl} />);



      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      // Mock the status update API
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });


      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/${mockPendingAppointment.id}/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"status":"cancelled"')
          })
        );
      });
    });

    it('should call no-show API when clicking No-Show button', async () => {
      const user = userEvent.setup();



      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats, [mockPendingAppointment]);
      localStorageMock.getItem.mockReturnValue('valid-token');

      render(<AdminDashboard serverUrl={serverUrl} />);



      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('No-Show')).toBeInTheDocument();
      });

      // Mock the status update API
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });


      const noShowButton = screen.getByText('No-Show');
      await user.click(noShowButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/${mockPendingAppointment.id}/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"status":"no-show"')
          })
        );
      });
    });

    it('should show date filter buttons', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats, [mockPendingAppointment]);

      render(<AdminDashboard serverUrl={serverUrl} />);



      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Week')).toBeInTheDocument();
        expect(screen.getByText('Month')).toBeInTheDocument();
        expect(screen.getByText('All')).toBeInTheDocument();
      });
    });

    it('should show pending confirmation count in overview when pending > 0', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Pending Confirmation')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument(); // pending count
      });
    });
  });

  describe('Tab Navigation', () => {
    const mockStats = {
      todayAppointments: 5,
      weekAppointments: 20,
      monthAppointments: 80,
      totalRevenue: 5000,
      cancelledCount: 3,
      upcomingCount: 15,
      waitlistCount: 2,
      pendingCallbacksCount: 4,
      topServices: []
    };

    const mockAppointmentStats = {
      total: 100,
      pending: 10,
      confirmed: 20,
      completed: 70,
      cancelled: 5,
      noShow: 5,
      noShowRate: 7
    };

    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('valid-token');
    });

    it('should have Overview tab active by default', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      // Wait for dashboard to load first
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });

      await waitFor(() => {
        const overviewTab = screen.getByRole('button', { name: 'Overview' });
        expect(overviewTab).toHaveClass('active');
      }, { timeout: 3000 });
    });

    it('should render all tabs', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) });
      setupMockData(mockStats, [], mockAppointmentStats);

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByRole('button', { name: 'Appointments' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Callbacks' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Staff' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Holidays' })).toBeInTheDocument();
    });
  });
});
