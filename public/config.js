// Global Frontend Configuration for Netlify & Render
(function () {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Hardcoded Live Cloudflare Tunnel Backend URL
  const productionBackendUrl = 'https://announcements-assignment-cycling-industrial.trycloudflare.com';

  let savedUrl = localStorage.getItem('AGRI_BACKEND_URL');
  // Clear any old placeholder value or old render url
  if (savedUrl && (savedUrl.includes('YOUR-RENDER-BACKEND') || savedUrl.includes('jb-project-qq1e.onrender.com'))) {
    localStorage.removeItem('AGRI_BACKEND_URL');
    savedUrl = null;
  }

  const apiUrl = savedUrl || (isLocal ? 'http://localhost:3000' : productionBackendUrl);

  window.CONFIG = {
    API_URL: apiUrl.replace(/\/$/, '')
  };

  console.log(`📡 AgriDispatch Backend URL: ${window.CONFIG.API_URL}`);
})();
