import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/widget.css';

// Create mount point if it doesn't exist
let container = document.getElementById('ai-receptionist-root');
if (!container) {
  container = document.createElement('div');
  container.id = 'ai-receptionist-root';
  document.body.appendChild(container);
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Export for UMD build
export { App as AIReceptionist };
// Force rebuild Mon Dec 29 22:57:35 PKT 2025
