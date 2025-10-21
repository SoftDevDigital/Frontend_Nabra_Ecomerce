'use client';

import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export const useServiceWorker = () => {
  const [swState, setSwState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    registration: null,
  });

  useEffect(() => {
    // Verificar si el navegador soporta Service Workers
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers no soportados en este navegador');
      return;
    }

    setSwState(prev => ({ ...prev, isSupported: true }));

    // Registrar Service Worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('✅ Service Worker registrado:', registration);

        setSwState(prev => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Escuchar actualizaciones del Service Worker
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Nueva versión del Service Worker encontrada');
          
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ Nueva versión del Service Worker instalada');
                setSwState(prev => ({ ...prev, isUpdateAvailable: true }));
              }
            });
          }
        });

        // Escuchar mensajes del Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'VERSION_CHECK') {
            console.log('🔄 Verificación de versión:', event.data);
            // Aquí podrías implementar lógica adicional si es necesario
          }
        });

      } catch (error) {
        console.error('❌ Error registrando Service Worker:', error);
      }
    };

    registerSW();

    // Limpiar listeners al desmontar
    return () => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', () => {});
      }
    };
  }, []);

  // Función para actualizar el Service Worker
  const updateServiceWorker = async () => {
    if (swState.registration && swState.registration.waiting) {
      swState.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  // Función para verificar actualizaciones manualmente
  const checkForUpdates = async () => {
    if (swState.registration) {
      try {
        await swState.registration.update();
        console.log('🔄 Verificación de actualizaciones completada');
      } catch (error) {
        console.error('❌ Error verificando actualizaciones:', error);
      }
    }
  };

  return {
    ...swState,
    updateServiceWorker,
    checkForUpdates,
  };
};


