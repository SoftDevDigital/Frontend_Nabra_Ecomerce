"use client";

import { useEffect } from "react";
import { usePerformanceMonitor } from "@/app/hooks/usePerformanceMonitor";

export default function ConsoleMonitor() {
  const { 
    currentMetrics, 
    isMonitoring, 
    generateConsoleReport,
    getStats 
  } = usePerformanceMonitor();

  useEffect(() => {
    // Solo en desarrollo
    if (process.env.NODE_ENV !== 'development') return;

    // Generar reporte inicial después de 3 segundos
    const initialTimer = setTimeout(() => {
      generateConsoleReport();
    }, 3000);

    // Generar reporte cada 30 segundos si está monitoreando
    let interval: NodeJS.Timeout | null = null;
    
    if (isMonitoring) {
      interval = setInterval(() => {
        generateConsoleReport();
      }, 30000);
    }

    return () => {
      clearTimeout(initialTimer);
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, generateConsoleReport]);

  // Mostrar estadísticas cuando cambien las métricas
  useEffect(() => {
    if (currentMetrics && process.env.NODE_ENV === 'development') {
      const stats = getStats();
      if (stats) {
        console.log('📈 Performance Stats Updated:', {
          'LCP Avg': `${stats.lcp.avg.toFixed(0)}ms`,
          'FID Avg': `${stats.fid.avg.toFixed(0)}ms`,
          'CLS Avg': stats.cls.avg.toFixed(3),
          'Bundle Size Avg': `${(stats.bundleSize.avg / 1024).toFixed(1)}KB`,
          'Load Time Avg': `${stats.loadTime.avg.toFixed(0)}ms`,
        });
      }
    }
  }, [currentMetrics, getStats]);

  return null;
}




