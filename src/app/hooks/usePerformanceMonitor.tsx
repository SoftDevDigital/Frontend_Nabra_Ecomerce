"use client";

import { useEffect, useState, useCallback } from "react";

interface PerformanceData {
  timestamp: number;
  url: string;
  metrics: {
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
    bundleSize: number;
    resourceCount: number;
    loadTime: number;
    memoryUsage?: number;
  };
  scores: {
    lcp: 'good' | 'needs-improvement' | 'poor';
    fid: 'good' | 'needs-improvement' | 'poor';
    cls: 'good' | 'needs-improvement' | 'poor';
    overall: 'good' | 'needs-improvement' | 'poor';
  };
}

export function usePerformanceMonitor() {
  const [data, setData] = useState<PerformanceData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceData | null>(null);

  // Función para calcular scores
  const calculateScores = (metrics: PerformanceData['metrics']) => {
    const lcpScore = metrics.lcp ? 
      (metrics.lcp <= 2500 ? 'good' : metrics.lcp <= 4000 ? 'needs-improvement' : 'poor') : 'good';
    
    const fidScore = metrics.fid ? 
      (metrics.fid <= 100 ? 'good' : metrics.fid <= 300 ? 'needs-improvement' : 'poor') : 'good';
    
    const clsScore = metrics.cls ? 
      (metrics.cls <= 0.1 ? 'good' : metrics.cls <= 0.25 ? 'needs-improvement' : 'poor') : 'good';

    const overallScore = (lcpScore === 'good' && fidScore === 'good' && clsScore === 'good') ? 'good' :
      (lcpScore === 'poor' || fidScore === 'poor' || clsScore === 'poor') ? 'poor' : 'needs-improvement';

    return { lcp: lcpScore, fid: fidScore, cls: clsScore, overall: overallScore };
  };

  // Función para medir métricas actuales
  const measureCurrentMetrics = useCallback(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    let bundleSize = 0;
    let resourceCount = 0;

    resources.forEach(resource => {
      if (resource.name.includes('_next/static')) {
        resourceCount++;
        bundleSize += resource.transferSize || 0;
      }
    });

    const metrics = {
      bundleSize,
      resourceCount,
      loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
      memoryUsage: 'memory' in performance ? (performance as any).memory.usedJSHeapSize / 1024 / 1024 : undefined,
    };

    const scores = calculateScores(metrics);

    const performanceData: PerformanceData = {
      timestamp: Date.now(),
      url: window.location.href,
      metrics,
      scores,
    };

    setCurrentMetrics(performanceData);
    return performanceData;
  }, []);

  // Función para medir Core Web Vitals
  const measureWebVitals = useCallback(() => {
    const vitals: Partial<PerformanceData['metrics']> = {};

    // LCP
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      vitals.lcp = lastEntry.startTime;
      setCurrentMetrics(prev => prev ? { ...prev, metrics: { ...prev.metrics, lcp: lastEntry.startTime } } : null);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // FID
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        const fid = (entry as any).processingStart - entry.startTime;
        vitals.fid = fid;
        setCurrentMetrics(prev => prev ? { ...prev, metrics: { ...prev.metrics, fid } } : null);
      });
    }).observe({ entryTypes: ['first-input'] });

    // CLS
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          vitals.cls = clsValue;
          setCurrentMetrics(prev => prev ? { ...prev, metrics: { ...prev.metrics, cls: clsValue } } : null);
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });

    // FCP
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        vitals.fcp = entry.startTime;
        setCurrentMetrics(prev => prev ? { ...prev, metrics: { ...prev.metrics, fcp: entry.startTime } } : null);
      });
    }).observe({ entryTypes: ['paint'] });

    // TTFB
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      vitals.ttfb = navigation.responseStart - navigation.requestStart;
      setCurrentMetrics(prev => prev ? { ...prev, metrics: { ...prev.metrics, ttfb: vitals.ttfb } } : null);
    }

    return vitals;
  }, []);

  // Función para iniciar monitoreo
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    measureWebVitals();
    
    // Medir métricas iniciales
    const initialData = measureCurrentMetrics();
    setData([initialData]);

    // Medir métricas cada 5 segundos
    const interval = setInterval(() => {
      const newData = measureCurrentMetrics();
      setData(prev => [...prev.slice(-9), newData]); // Mantener solo los últimos 10 registros
    }, 5000);

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [isMonitoring, measureWebVitals, measureCurrentMetrics]);

  // Función para detener monitoreo
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Función para limpiar datos
  const clearData = useCallback(() => {
    setData([]);
    setCurrentMetrics(null);
  }, []);

  // Función para exportar datos
  const exportData = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      data,
      currentMetrics,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nabra-performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, currentMetrics]);

  // Función para generar reporte en consola
  const generateConsoleReport = useCallback(() => {
    if (!currentMetrics) return;

    console.group('🚀 NABRA Performance Report');
    console.log('📊 Core Web Vitals:', {
      LCP: currentMetrics.metrics.lcp ? `${currentMetrics.metrics.lcp.toFixed(0)}ms (${currentMetrics.scores.lcp})` : 'N/A',
      FID: currentMetrics.metrics.fid ? `${currentMetrics.metrics.fid.toFixed(0)}ms (${currentMetrics.scores.fid})` : 'N/A',
      CLS: currentMetrics.metrics.cls ? `${currentMetrics.metrics.cls.toFixed(3)} (${currentMetrics.scores.cls})` : 'N/A',
    });
    console.log('📦 Bundle Info:', {
      Size: `${(currentMetrics.metrics.bundleSize / 1024).toFixed(1)}KB`,
      Resources: currentMetrics.metrics.resourceCount,
      Load Time: `${currentMetrics.metrics.loadTime.toFixed(0)}ms`,
    });
    console.log('💾 Memory:', currentMetrics.metrics.memoryUsage ? `${currentMetrics.metrics.memoryUsage.toFixed(1)}MB` : 'N/A');
    console.log('🎯 Overall Score:', currentMetrics.scores.overall.toUpperCase());
    console.log('📈 Historical Data:', data.length, 'records');
    console.groupEnd();
  }, [currentMetrics, data]);

  // Función para obtener estadísticas
  const getStats = useCallback(() => {
    if (data.length === 0) return null;

    const lcpValues = data.map(d => d.metrics.lcp).filter(Boolean) as number[];
    const fidValues = data.map(d => d.metrics.fid).filter(Boolean) as number[];
    const clsValues = data.map(d => d.metrics.cls).filter(Boolean) as number[];
    const bundleSizes = data.map(d => d.metrics.bundleSize);
    const loadTimes = data.map(d => d.metrics.loadTime);

    return {
      lcp: {
        avg: lcpValues.length > 0 ? lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length : 0,
        min: lcpValues.length > 0 ? Math.min(...lcpValues) : 0,
        max: lcpValues.length > 0 ? Math.max(...lcpValues) : 0,
      },
      fid: {
        avg: fidValues.length > 0 ? fidValues.reduce((a, b) => a + b, 0) / fidValues.length : 0,
        min: fidValues.length > 0 ? Math.min(...fidValues) : 0,
        max: fidValues.length > 0 ? Math.max(...fidValues) : 0,
      },
      cls: {
        avg: clsValues.length > 0 ? clsValues.reduce((a, b) => a + b, 0) / clsValues.length : 0,
        min: clsValues.length > 0 ? Math.min(...clsValues) : 0,
        max: clsValues.length > 0 ? Math.max(...clsValues) : 0,
      },
      bundleSize: {
        avg: bundleSizes.reduce((a, b) => a + b, 0) / bundleSizes.length,
        min: Math.min(...bundleSizes),
        max: Math.max(...bundleSizes),
      },
      loadTime: {
        avg: loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length,
        min: Math.min(...loadTimes),
        max: Math.max(...loadTimes),
      },
    };
  }, [data]);

  // Iniciar monitoreo automáticamente en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      startMonitoring();
    }
  }, [startMonitoring]);

  return {
    data,
    currentMetrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearData,
    exportData,
    generateConsoleReport,
    getStats,
  };
}

