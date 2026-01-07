import React, { useState, useEffect, Suspense, lazy } from 'react';
import ChatWidget from './components/ChatWidget';
import LandingPage from './components/LandingPage';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthModal';
import './styles/admin.css';
import './styles/landing.css';

// Lazy load AdminDashboard - only loaded when user navigates to /admin
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

// Loading fallback for lazy-loaded components
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#fff',
    fontSize: '1.2rem'
  }}>
    <div>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(255,255,255,0.3)',
        borderTop: '3px solid #fff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 1rem'
      }} />
      Loading...
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

interface AppContentProps {
  serverUrl: string;
}

// Main App content with auth context
const AppContent: React.FC<AppContentProps> = ({ serverUrl }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<'landing' | 'admin' | 'login' | 'register' | 'verify-email' | 'reset-password'>('landing');
  const [chatOpen, setChatOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const checkPath = () => {
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      const search = window.location.search;

      if (hash === '#/admin' || pathname === '/admin') {
        setCurrentPage('admin');
      } else if (hash === '#/login' || pathname === '/login') {
        setAuthModalOpen(true);
        setAuthModalView('login');
      } else if (hash === '#/register' || pathname === '/register') {
        setAuthModalOpen(true);
        setAuthModalView('register');
      } else if (hash.startsWith('#/verify-email') || pathname === '/verify-email') {
        setCurrentPage('verify-email');
      } else if (hash.startsWith('#/reset-password') || pathname === '/reset-password') {
        setCurrentPage('reset-password');
      } else {
        setCurrentPage('landing');
      }

      // Handle OAuth token in URL
      const params = new URLSearchParams(search);
      const authToken = params.get('auth_token');
      if (authToken) {
        localStorage.setItem('auth_token', authToken);
        window.location.href = window.location.pathname; // Remove token from URL
      }
    };

    checkPath();
    window.addEventListener('hashchange', checkPath);
    window.addEventListener('popstate', checkPath);
    return () => {
      window.removeEventListener('hashchange', checkPath);
      window.removeEventListener('popstate', checkPath);
    };
  }, []);

  // Handle verify email page
  if (currentPage === 'verify-email') {
    return <VerifyEmailPage />;
  }

  // Handle reset password page
  if (currentPage === 'reset-password') {
    return <ResetPasswordPage />;
  }

  if (currentPage === 'admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminDashboard serverUrl={serverUrl} />
      </Suspense>
    );
  }

  return (
    <div>
      <LandingPage
        onOpenChat={() => setChatOpen(true)}
        onLoginClick={() => {
          setAuthModalView('login');
          setAuthModalOpen(true);
        }}
        onRegisterClick={() => {
          setAuthModalView('register');
          setAuthModalOpen(true);
        }}
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={logout}
      />
      <ChatWidget
        serverUrl={serverUrl}
        defaultOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authModalView}
        onSuccess={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

// Verify Email Page Component
const VerifyEmailPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    fetch(`${API_URL}/api/user-auth/verify-email/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage('Email verified successfully! You can now login.');
          if (data.token) {
            localStorage.setItem('auth_token', data.token);
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Please try again.');
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        padding: '3rem',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h2>Verifying your email...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2>Email Verified!</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>{message}</p>
            <a href="/" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600'
            }}>Go to Home</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <h2>Verification Failed</h2>
            <p style={{ color: '#dc2626', marginBottom: '1.5rem' }}>{message}</p>
            <a href="/" style={{
              display: 'inline-block',
              background: '#f3f4f6',
              color: '#374151',
              padding: '12px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600'
            }}>Go to Home</a>
          </>
        )}
      </div>
    </div>
  );
};

// Reset Password Page Component
const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [message, setMessage] = useState('');
  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid reset link');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${API_URL}/api/user-auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage('Password reset successfully!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Reset failed');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        padding: '3rem',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {status === 'form' && (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Reset Password</h2>
            {message && <p style={{ color: '#dc2626', marginBottom: '1rem', textAlign: 'center' }}>{message}</p>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button type="submit" style={{
                width: '100%',
                padding: '1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Reset Password</button>
            </form>
          </>
        )}
        {status === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h2>Resetting password...</h2>
          </div>
        )}
        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2>Password Reset!</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>{message}</p>
            <a href="/#/login" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600'
            }}>Go to Login</a>
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <h2>Reset Failed</h2>
            <p style={{ color: '#dc2626', marginBottom: '1.5rem' }}>{message}</p>
            <a href="/" style={{
              display: 'inline-block',
              background: '#f3f4f6',
              color: '#374151',
              padding: '12px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600'
            }}>Go to Home</a>
          </div>
        )}
      </div>
    </div>
  );
};

interface AppProps {
  serverUrl?: string;
}

const App: React.FC<AppProps> = ({
  serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
}) => {
  return (
    <AuthProvider>
      <AppContent serverUrl={serverUrl} />
    </AuthProvider>
  );
};

export default App;
