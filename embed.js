(function() {
  // AI Receptionist Widget Embed Script
  // Usage: Add this script to your website to embed the chat widget

  // Configuration
  var config = window.AIReceptionistConfig || {};
  var serverUrl = config.serverUrl || 'http://localhost:3000';
  var widgetUrl = config.widgetUrl || serverUrl + '/widget';

  // Create widget container
  var container = document.createElement('div');
  container.id = 'ai-receptionist-root';
  document.body.appendChild(container);

  // Load widget styles
  var styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = widgetUrl + '/ai-receptionist-widget.css';
  document.head.appendChild(styles);

  // Load widget script
  var script = document.createElement('script');
  script.src = widgetUrl + '/ai-receptionist-widget.js';
  script.onload = function() {
    // Widget will auto-initialize
    console.log('AI Receptionist widget loaded');
  };
  document.body.appendChild(script);
})();
