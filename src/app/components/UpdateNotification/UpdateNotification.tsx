'use client';

import { useState, useEffect } from 'react';
import { useVersionCheck } from '@/app/hooks/useVersionCheck';
import styles from './UpdateNotification.module.css';

interface UpdateNotificationProps {
  checkInterval?: number;
  autoReload?: boolean;
  showVersion?: boolean;
}

export default function UpdateNotification({ 
  checkInterval = 30000,
  autoReload = false,
  showVersion = false 
}: UpdateNotificationProps) {
  const { isUpdateAvailable, isChecking, currentVersion, handleManualReload } = useVersionCheck({
    checkInterval,
    autoReload,
    showNotification: true
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isUpdateAvailable) {
      setIsVisible(true);
    }
  }, [isUpdateAvailable]);

  const handleReload = () => {
    handleManualReload();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.notification}>
        <div className={styles.content}>
          <div className={styles.icon}>🔄</div>
          <div className={styles.text}>
            <h3>¡Nueva versión disponible!</h3>
            <p>Se han encontrado actualizaciones. Recarga la página para ver los últimos cambios.</p>
            {showVersion && (
              <small>Versión actual: {currentVersion}</small>
            )}
          </div>
        </div>
        
        <div className={styles.actions}>
          <button 
            onClick={handleDismiss}
            className={styles.dismissButton}
            disabled={isChecking}
          >
            Más tarde
          </button>
          <button 
            onClick={handleReload}
            className={styles.reloadButton}
            disabled={isChecking}
          >
            {isChecking ? 'Recargando...' : 'Recargar ahora'}
          </button>
        </div>
      </div>
    </div>
  );
}


