import React, { useState, useEffect, Suspense, lazy } from 'react';
import ChatWidget from './components/ChatWidget';
import LandingPage from './components/LandingPage';
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

interface AppProps {
  serverUrl?: string;
}

const App: React.FC<AppProps> = ({
  serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
}) => {
  const [currentPage, setCurrentPage] = useState<'landing' | 'admin'>('landing');
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const checkPath = () => {
      if (window.location.hash === '#/admin' || window.location.pathname === '/admin') {
        setCurrentPage('admin');
      } else {
        setCurrentPage('landing');
      }
    };

    checkPath();
    window.addEventListener('hashchange', checkPath);
    return () => window.removeEventListener('hashchange', checkPath);
  }, []);

  if (currentPage === 'admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminDashboard serverUrl={serverUrl} />
      </Suspense>
    );
  }

  return (
    <div>
      <LandingPage onOpenChat={() => setChatOpen(true)} />
      <ChatWidget serverUrl={serverUrl} defaultOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default App;

