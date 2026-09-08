// Global Frontend Configuration for Netlify & Render
(function () {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Hardcoded Live Render Backend URL
  const productionBackendUrl = 'https://jb-project-qq1e.onrender.com';

  let savedUrl = localStorage.getItem('AGRI_BACKEND_URL');
  // Clear any old placeholder value
  if (savedUrl && savedUrl.includes('YOUR-RENDER-BACKEND')) {
    localStorage.removeItem('AGRI_BACKEND_URL');
    savedUrl = null;
  }

  const apiUrl = savedUrl || (isLocal ? 'http://localhost:3000' : productionBackendUrl);

  window.CONFIG = {
    API_URL: apiUrl.replace(/\/$/, '')
  };

  console.log(`📡 AgriDispatch Backend URL: ${window.CONFIG.API_URL}`);
})();
