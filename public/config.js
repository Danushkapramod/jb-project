// Global Frontend Configuration for Netlify & Local Cloudflare Tunnel
(function () {
  const currentOrigin = window.location.origin;
  const isDirect = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' || 
                   window.location.hostname.includes('trycloudflare.com');
  
  // Production Cloudflare Tunnel URL
  const productionBackendUrl = 'https://announcements-assignment-cycling-industrial.trycloudflare.com';

  let savedUrl = localStorage.getItem('AGRI_BACKEND_URL');
  // Clear any old render urls
  if (savedUrl && (savedUrl.includes('onrender.com') || savedUrl.includes('YOUR-RENDER-BACKEND'))) {
    localStorage.removeItem('AGRI_BACKEND_URL');
    savedUrl = null;
  }

  // If accessed directly on localhost or via Cloudflare tunnel, use currentOrigin.
  // If accessed from Netlify, use productionBackendUrl.
  const apiUrl = savedUrl || (isDirect ? currentOrigin : productionBackendUrl);

  window.CONFIG = {
    API_URL: apiUrl.replace(/\/$/, '')
  };

  console.log(`📡 Agri Connect Backend URL: ${window.CONFIG.API_URL}`);
})();
