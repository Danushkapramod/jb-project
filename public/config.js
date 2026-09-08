// Global Frontend Configuration for Netlify & Render
(function () {
  // Determine default API URL:
  // If running locally, use http://localhost:3000
  // If running on Netlify, use the configured Render URL
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Default Render URL (User can change this in the UI or in this file)
  const defaultRenderUrl = 'https://YOUR-RENDER-BACKEND.onrender.com';

  const savedUrl = localStorage.getItem('AGRI_BACKEND_URL');
  const apiUrl = savedUrl || (isLocal ? 'http://localhost:3000' : defaultRenderUrl);

  window.CONFIG = {
    API_URL: apiUrl.replace(/\/$/, '') // strip trailing slash
  };

  console.log(`📡 AgriDispatch connected to backend: ${window.CONFIG.API_URL}`);

  // Global helper to let the user change the backend URL directly in the UI
  window.setBackendUrl = function () {
    const current = localStorage.getItem('AGRI_BACKEND_URL') || window.CONFIG.API_URL;
    const input = prompt(
      'Enter your Render Backend URL (e.g. https://agri-backend.onrender.com):',
      current
    );
    if (input !== null && input.trim() !== '') {
      const formatted = input.trim().replace(/\/$/, '');
      localStorage.setItem('AGRI_BACKEND_URL', formatted);
      alert('Backend URL saved! Reloading page...');
      window.location.reload();
    }
  };

  window.resetBackendUrl = function () {
    localStorage.removeItem('AGRI_BACKEND_URL');
    alert('Reset to default backend URL! Reloading...');
    window.location.reload();
  };
})();
