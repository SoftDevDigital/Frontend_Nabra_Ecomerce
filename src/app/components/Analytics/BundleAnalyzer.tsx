"use client";

import { useEffect, useState } from "react";

interface BundleStats {
  jsSize: number;
  cssSize: number;
  totalSize: number;
  loadTime: number;
  resourceCount: number;
}

export default function BundleAnalyzer() {
  const [stats, setStats] = useState<BundleStats | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo en desarrollo
    if (process.env.NODE_ENV !== 'development') return;

    const analyzeBundle = () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      let jsSize = 0;
      let cssSize = 0;
      let resourceCount = 0;

      resources.forEach(resource => {
        if (resource.name.includes('_next/static')) {
          resourceCount++;
          if (resource.name.endsWith('.js')) {
            jsSize += resource.transferSize || 0;
          } else if (resource.name.endsWith('.css')) {
            cssSize += resource.transferSize || 0;
          }
        }
      });

      const totalSize = jsSize + cssSize;
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;

      setStats({
        jsSize,
        cssSize,
        totalSize,
        loadTime,
        resourceCount,
      });
    };

    // Analizar después de que la página cargue
    const timer = setTimeout(analyzeBundle, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!stats || process.env.NODE_ENV !== 'development') return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg text-sm z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 text-xs bg-gray-700 px-2 py-1 rounded"
      >
        {isVisible ? 'Ocultar' : 'Mostrar'} Bundle Stats
      </button>
      
      {isVisible && (
        <div className="space-y-1">
          <div>JS: {formatBytes(stats.jsSize)}</div>
          <div>CSS: {formatBytes(stats.cssSize)}</div>
          <div>Total: {formatBytes(stats.totalSize)}</div>
          <div>Recursos: {stats.resourceCount}</div>
          <div>Tiempo: {stats.loadTime.toFixed(0)}ms</div>
        </div>
      )}
    </div>
  );
}


