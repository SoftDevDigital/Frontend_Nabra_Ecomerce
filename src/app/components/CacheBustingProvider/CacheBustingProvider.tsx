'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '@/app/hooks/useServiceWorker';
import { useVersionCheck } from '@/app/hooks/useVersionCheck';
import UpdateNotification from '../UpdateNotification/UpdateNotification';

interface CacheBustingProviderProps {
  children: React.ReactNode;
  checkInterval?: number;
  autoReload?: boolean;
  showVersion?: boolean;
}

export default function CacheBustingProvider({ 
  children, 
  checkInterval = 30000,
  autoReload = false,
  showVersion = false 
}: CacheBustingProviderProps) {
  const { isSupported: swSupported, isRegistered: swRegistered } = useServiceWorker();
  const { isUpdateAvailable, currentVersion } = useVersionCheck({
    checkInterval,
    autoReload,
    showNotification: true
  });

  useEffect(() => {
    // Log del estado del sistema de cache busting
    console.log('🔧 Cache Busting System Status:', {
      'Service Worker Supported': swSupported,
      'Service Worker Registered': swRegistered,
      'Update Available': isUpdateAvailable,
      'Current Version': currentVersion,
      'Check Interval': `${checkInterval / 1000}s`,
      'Auto Reload': autoReload
    });

    // Agregar meta tags dinámicos para cache busting
    if (typeof window !== 'undefined') {
      // Agregar timestamp al título para forzar recarga
      const originalTitle = document.title;
      const timestamp = Date.now();
      
      // Solo agregar timestamp en desarrollo o si hay actualizaciones
      if (process.env.NODE_ENV === 'development' || isUpdateAvailable) {
        document.title = `${originalTitle} (v${currentVersion})`;
      }

      // Agregar meta tag para version
      let versionMeta = document.querySelector('meta[name="app-version"]');
      if (!versionMeta) {
        versionMeta = document.createElement('meta');
        versionMeta.setAttribute('name', 'app-version');
        versionMeta.setAttribute('content', currentVersion);
        document.head.appendChild(versionMeta);
      } else {
        versionMeta.setAttribute('content', currentVersion);
      }

      // Agregar meta tag para build timestamp
      let buildMeta = document.querySelector('meta[name="build-timestamp"]');
      if (!buildMeta) {
        buildMeta = document.createElement('meta');
        buildMeta.setAttribute('name', 'build-timestamp');
        buildMeta.setAttribute('content', timestamp.toString());
        document.head.appendChild(buildMeta);
      } else {
        buildMeta.setAttribute('content', timestamp.toString());
      }
    }
  }, [swSupported, swRegistered, isUpdateAvailable, currentVersion, checkInterval, autoReload]);

  return (
    <>
      {children}
      
      {/* Componente de notificación de actualizaciones */}
      <UpdateNotification 
        checkInterval={checkInterval}
        autoReload={autoReload}
        showVersion={showVersion}
      />
    </>
  );
}

