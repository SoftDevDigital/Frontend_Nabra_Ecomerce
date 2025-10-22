// Este archivo se genera automáticamente en cada build
// No editar manualmente

export const APP_VERSION = '159785cb';
export const BUILD_TIMESTAMP = 1761060574338;
export const BUILD_TIME = '2025-10-21T15:29:34.338Z';

// Función para verificar si hay una nueva versión disponible (ultra rápida)
export const checkForUpdates = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/version?' + Date.now(), {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.version !== APP_VERSION;
  } catch (error) {
    // Silencioso - no mostrar errores al usuario
    return false;
  }
};

// Función para forzar recarga de la página (instantánea)
export const forceReload = () => {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

// Función para obtener información de versión
export const getVersionInfo = () => ({
  version: APP_VERSION,
  timestamp: BUILD_TIMESTAMP,
  buildTime: BUILD_TIME,
  isDevelopment: process.env.NODE_ENV === 'development'
});
