import React, { useState, useEffect } from 'react';
import ChatWidget from './components/ChatWidget';
import AdminDashboard from './components/AdminDashboard';
import LandingPage from './components/LandingPage';
import './styles/admin.css';
import './styles/landing.css';

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
    return <AdminDashboard serverUrl={serverUrl} />;
  }

  return (
    <div>
      <LandingPage onOpenChat={() => setChatOpen(true)} />
      <ChatWidget serverUrl={serverUrl} defaultOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default App;
