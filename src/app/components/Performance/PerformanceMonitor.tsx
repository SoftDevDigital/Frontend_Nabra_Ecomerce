"use client";

import { useEffect, useState } from "react";

interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  bundleSize: number;
  resourceCount: number;
  loadTime: number;
  memoryUsage: number | null;
}

interface PerformanceScore {
  lcp: 'good' | 'needs-improvement' | 'poor';
  fid: 'good' | 'needs-improvement' | 'poor';
  cls: 'good' | 'needs-improvement' | 'poor';
  overall: 'good' | 'needs-improvement' | 'poor';
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    bundleSize: 0,
    resourceCount: 0,
    loadTime: 0,
    memoryUsage: null,
  });

  const [scores, setScores] = useState<PerformanceScore>({
    lcp: 'good',
    fid: 'good',
    cls: 'good',
    overall: 'good',
  });

  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Función para calcular scores de Core Web Vitals
  const calculateScores = (metrics: PerformanceMetrics): PerformanceScore => {
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

  // Función para obtener color según score
  const getScoreColor = (score: 'good' | 'needs-improvement' | 'poor') => {
    switch (score) {
      case 'good': return '#10b981'; // green
      case 'needs-improvement': return '#f59e0b'; // yellow
      case 'poor': return '#ef4444'; // red
    }
  };

  // Función para formatear bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Función para medir Core Web Vitals
  const measureWebVitals = () => {
    // LCP - Largest Contentful Paint
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // FID - First Input Delay
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        const fid = (entry as any).processingStart - entry.startTime;
        setMetrics(prev => ({ ...prev, fid }));
      });
    }).observe({ entryTypes: ['first-input'] });

    // CLS - Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          setMetrics(prev => ({ ...prev, cls: clsValue }));
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });

    // FCP - First Contentful Paint
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        setMetrics(prev => ({ ...prev, fcp: entry.startTime }));
      });
    }).observe({ entryTypes: ['paint'] });

    // TTFB - Time to First Byte
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      setMetrics(prev => ({ ...prev, ttfb: navigation.responseStart - navigation.requestStart }));
    }
  };

  // Función para medir bundle size y recursos
  const measureBundleSize = () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let totalSize = 0;
    let resourceCount = 0;

    resources.forEach(resource => {
      if (resource.name.includes('_next/static')) {
        resourceCount++;
        totalSize += resource.transferSize || 0;
      }
    });

    setMetrics(prev => ({ 
      ...prev, 
      bundleSize: totalSize, 
      resourceCount 
    }));
  };

  // Función para medir tiempo de carga
  const measureLoadTime = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      setMetrics(prev => ({ ...prev, loadTime }));
    }
  };

  // Función para medir uso de memoria (si está disponible)
  const measureMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      setMetrics(prev => ({ 
        ...prev, 
        memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // MB
      }));
    }
  };

  // Función para generar reporte completo
  const generateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics,
      scores,
      recommendations: []
    };

    // Agregar recomendaciones basadas en métricas
    if (metrics.lcp && metrics.lcp > 2500) {
      (report.recommendations as string[]).push('Optimizar LCP: Preload recursos críticos, optimizar imágenes');
    }
    if (metrics.fid && metrics.fid > 100) {
      (report.recommendations as string[]).push('Optimizar FID: Reducir JavaScript bloqueante, usar web workers');
    }
    if (metrics.cls && metrics.cls > 0.1) {
      (report.recommendations as string[]).push('Optimizar CLS: Reservar espacio para imágenes, evitar contenido dinámico');
    }
    if (metrics.bundleSize > 500000) {
      (report.recommendations as string[]).push('Reducir bundle size: Code splitting, tree shaking');
    }

    console.group('🚀 NABRA Performance Report');
    console.log('📊 Core Web Vitals:', {
      LCP: `${metrics.lcp?.toFixed(0)}ms (${scores.lcp})`,
      FID: `${metrics.fid?.toFixed(0)}ms (${scores.fid})`,
      CLS: `${metrics.cls?.toFixed(3)} (${scores.cls})`,
    });
    console.log('📦 Bundle Info:', {
      Size: formatBytes(metrics.bundleSize),
      Resources: metrics.resourceCount,
      'Load Time': `${metrics.loadTime.toFixed(0)}ms`,
    });
    console.log('💾 Memory:', metrics.memoryUsage ? `${metrics.memoryUsage.toFixed(1)}MB` : 'N/A');
    console.log('🎯 Overall Score:', scores.overall.toUpperCase());
    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:', report.recommendations);
    }
    console.groupEnd();

    return report;
  };

  useEffect(() => {
    // Solo en desarrollo
    if (process.env.NODE_ENV !== 'development') return;

    // Medir métricas iniciales
    measureWebVitals();
    measureBundleSize();
    measureLoadTime();
    measureMemoryUsage();

    // Medir métricas después de la carga
    window.addEventListener('load', () => {
      setTimeout(() => {
        measureBundleSize();
        measureLoadTime();
        measureMemoryUsage();
        generateReport();
      }, 1000);
    });

    // Medir métricas cada 5 segundos
    const interval = setInterval(() => {
      measureMemoryUsage();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Actualizar scores cuando cambien las métricas
  useEffect(() => {
    setScores(calculateScores(metrics));
  }, [metrics]);

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Botón para mostrar/ocultar */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 bg-black text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        {isVisible ? '📊 Hide' : '📊 Show'} Performance
      </button>

      {isVisible && (
        <div className={`bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-80 ${isMinimized ? 'h-12 overflow-hidden' : ''}`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">Performance Monitor</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                {isMinimized ? '📈' : '📉'}
              </button>
              <button
                onClick={generateReport}
                className="text-gray-500 hover:text-gray-700 text-sm"
                title="Generate Console Report"
              >
                📋
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="space-y-3">
              {/* Core Web Vitals */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Core Web Vitals</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>LCP:</span>
                    <span style={{ color: getScoreColor(scores.lcp) }}>
                      {metrics.lcp ? `${metrics.lcp.toFixed(0)}ms` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>FID:</span>
                    <span style={{ color: getScoreColor(scores.fid) }}>
                      {metrics.fid ? `${metrics.fid.toFixed(0)}ms` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>CLS:</span>
                    <span style={{ color: getScoreColor(scores.cls) }}>
                      {metrics.cls ? metrics.cls.toFixed(3) : 'Loading...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bundle Info */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Bundle Info</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span>{formatBytes(metrics.bundleSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resources:</span>
                    <span>{metrics.resourceCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Load Time:</span>
                    <span>{metrics.loadTime.toFixed(0)}ms</span>
                  </div>
                </div>
              </div>

              {/* Memory Usage */}
              {metrics.memoryUsage && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Memory</h4>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>Used:</span>
                      <span>{metrics.memoryUsage.toFixed(1)}MB</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Overall Score */}
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Overall Score:</span>
                  <span 
                    className="px-2 py-1 rounded text-sm font-medium"
                    style={{ 
                      backgroundColor: getScoreColor(scores.overall) + '20',
                      color: getScoreColor(scores.overall)
                    }}
                  >
                    {scores.overall.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
