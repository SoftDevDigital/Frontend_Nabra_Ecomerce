'use client';

import { useEffect, useState, useCallback } from 'react';
import { checkForUpdates, forceReload, APP_VERSION } from '@/lib/version';

interface VersionCheckOptions {
  checkInterval?: number; // en milisegundos
  showNotification?: boolean;
  autoReload?: boolean;
}

export const useVersionCheck = (options: VersionCheckOptions = {}) => {
  const {
    checkInterval = 30000, // 30 segundos por defecto
    showNotification = true,
    autoReload = false
  } = options;

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);

  const checkForUpdate = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const hasUpdate = await checkForUpdates();
      setIsUpdateAvailable(hasUpdate);
      
      if (hasUpdate && showNotification) {
        console.log('🔄 Nueva versión disponible. Recargando...');
        
        if (autoReload) {
          // Esperar un poco antes de recargar para que el usuario vea la notificación
          setTimeout(() => {
            forceReload();
          }, 2000);
        }
      }
    } catch (error) {
      console.warn('Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, showNotification, autoReload]);

  // Verificar actualizaciones al montar el componente
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  // Configurar verificación periódica
  useEffect(() => {
    if (checkInterval <= 0) return;

    const interval = setInterval(checkForUpdate, checkInterval);
    return () => clearInterval(interval);
  }, [checkForUpdate, checkInterval]);

  // Verificar actualizaciones cuando la ventana vuelve a tener foco
  useEffect(() => {
    const handleFocus = () => {
      checkForUpdate();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkForUpdate]);

  const handleManualReload = useCallback(() => {
    forceReload();
  }, []);

  return {
    isUpdateAvailable,
    isChecking,
    currentVersion,
    checkForUpdate,
    handleManualReload,
  };
};

