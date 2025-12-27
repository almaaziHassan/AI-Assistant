import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDashboard from '../src/components/AdminDashboard';

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

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
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
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    });

    it('should show loading state while checking auth', () => {
      localStorageMock.getItem.mockReturnValue('some-token');
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AdminDashboard serverUrl={serverUrl} />);

      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    });

    it('should verify existing token on mount', async () => {
      const existingToken = 'existing-valid-token';
      localStorageMock.getItem.mockReturnValue(existingToken);

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDashboardStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

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
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, token }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDashboardStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      // Fill in password and submit
      const passwordInput = screen.getByPlaceholderText('Password');
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

      const passwordInput = screen.getByPlaceholderText('Password');
      await user.type(passwordInput, 'wrongpassword');

      const loginButton = screen.getByRole('button', { name: 'Login' });
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument();
      });
    });

    it('should show logout button when authenticated', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDashboardStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should logout when logout button is clicked', async () => {
      const user = userEvent.setup();
      const token = 'valid-token';
      localStorageMock.getItem.mockReturnValue(token);

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDashboardStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

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

    it('should logout on 401 response from protected route', async () => {
      const token = 'expired-token';
      localStorageMock.getItem.mockReturnValue(token);

      // Create a response object with status property
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce(unauthorizedResponse) // dashboard returns 401
        .mockResolvedValueOnce(unauthorizedResponse) // action required
        .mockResolvedValueOnce(unauthorizedResponse) // stats
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) }); // logout call from handleLogout

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('admin_auth_token');
      }, { timeout: 5000 });
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
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText("Today's Appointments")).toBeInTheDocument();
      });

      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('should show completed count from appointment stats', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('70')).toBeInTheDocument(); // Completed count
      });

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should show no-show count and rate', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('No-Shows (7%)')).toBeInTheDocument();
      });
    });
  });

  describe('Action Required Section', () => {
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

    const mockActionRequired = [
      {
        id: 'apt-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+14155551234',
        serviceName: 'Swedish Massage',
        staffName: 'Sarah',
        appointmentDate: '2025-12-25',
        appointmentTime: '10:00',
        duration: 60,
        status: 'confirmed'
      }
    ];

    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('valid-token');
    });

    it('should show action required section when appointments need action', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText(/Action Required/)).toBeInTheDocument();
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Swedish Massage')).toBeInTheDocument();
    });

    it('should show completed and no-show buttons for action required appointments', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('✓ Completed')).toBeInTheDocument();
        expect(screen.getByText('✗ No-Show')).toBeInTheDocument();
      });
    });

    it('should not show action required section when no appointments need action', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // Empty action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText("Today's Appointments")).toBeInTheDocument();
      });

      expect(screen.queryByText(/Action Required/)).not.toBeInTheDocument();
    });

    it('should call API when marking appointment as completed', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('✓ Completed')).toBeInTheDocument();
      });

      // Mock the status update API call
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      // Mock the stats refresh
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      const completedButton = screen.getByText('✓ Completed');
      await user.click(completedButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/apt-1/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' })
          })
        );
      });
    });

    it('should call API when marking appointment as no-show', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockActionRequired) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('✗ No-Show')).toBeInTheDocument();
      });

      // Mock the status update API call
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      // Mock the stats refresh
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      const noShowButton = screen.getByText('✗ No-Show');
      await user.click(noShowButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/apt-1/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'no-show' })
          })
        );
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

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Mock appointments list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPendingAppointment])
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

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Mock appointments list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPendingAppointment])
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

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Mock appointments list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPendingAppointment])
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });

      // Mock the status update API
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
      // Mock refetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ ...mockPendingAppointment, status: 'confirmed' }])
      });
      // Mock stats refresh
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      const confirmButton = screen.getByText('Confirm');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/${mockPendingAppointment.id}/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'confirmed' })
          })
        );
      });
    });

    it('should call cancel API when clicking Cancel button', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Mock appointments list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPendingAppointment])
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      // Mock the status update API
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
      // Mock refetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ ...mockPendingAppointment, status: 'cancelled' }])
      });
      // Mock stats refresh
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/${mockPendingAppointment.id}/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'cancelled' })
          })
        );
      });
    });

    it('should call no-show API when clicking No-Show button', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Mock appointments list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPendingAppointment])
      });

      const appointmentsTab = screen.getByText('Appointments');
      await user.click(appointmentsTab);

      await waitFor(() => {
        expect(screen.getByText('No-Show')).toBeInTheDocument();
      });

      // Mock the status update API
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
      // Mock refetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ ...mockPendingAppointment, status: 'no-show' }])
      });
      // Mock stats refresh
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) });

      const noShowButton = screen.getByText('No-Show');
      await user.click(noShowButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `${serverUrl}/api/appointments/${mockPendingAppointment.id}/status`,
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'no-show' })
          })
        );
      });
    });

    it('should show date filter buttons', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Appointments')).toBeInTheDocument();
      });

      // Mock appointments list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
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
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

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
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        const overviewTab = screen.getByText('Overview');
        expect(overviewTab).toHaveClass('active');
      });
    });

    it('should render all tabs', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ valid: true }) }) // verify
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStats) }) // dashboard
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // action required
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAppointmentStats) }); // stats

      render(<AdminDashboard serverUrl={serverUrl} />);

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      expect(screen.getByText('Appointments')).toBeInTheDocument();
      expect(screen.getByText('Callbacks')).toBeInTheDocument();
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Holidays')).toBeInTheDocument();
      expect(screen.getByText('Waitlist')).toBeInTheDocument();
    });
  });
});
