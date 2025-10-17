"use client";

import { useEffect, useState } from "react";

export default function SimplePerformanceMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    bundleSize: 0,
    resourceCount: 0,
    memoryUsage: 0,
  });

  useEffect(() => {
    // Solo en desarrollo
    if (process.env.NODE_ENV !== 'development') return;

    const measureMetrics = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      let bundleSize = 0;
      let resourceCount = 0;

      resources.forEach(resource => {
        if (resource.name.includes('_next/static')) {
          resourceCount++;
          bundleSize += resource.transferSize || 0;
        }
      });

      const loadTime = navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0;
      const memoryUsage = 'memory' in performance ? (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0;

      setMetrics({
        loadTime: Math.round(loadTime),
        bundleSize: Math.round(bundleSize / 1024),
        resourceCount,
        memoryUsage: Math.round(memoryUsage * 10) / 10,
      });
    };

    // Medir después de la carga
    window.addEventListener('load', () => {
      setTimeout(measureMetrics, 1000);
    });

    // Configurar comandos de consola
    (window as any).nabra = {
      performance: {
        measure: () => {
          measureMetrics();
          console.log('📊 Current Metrics:', {
            'Load Time': `${metrics.loadTime}ms`,
            'Bundle Size': `${metrics.bundleSize}KB`,
            'Resources': metrics.resourceCount,
            'Memory': `${metrics.memoryUsage}MB`,
          });
        },
        report: () => {
          console.group('🚀 NABRA Performance Report');
          console.log('📊 Metrics:', {
            'Load Time': `${metrics.loadTime}ms`,
            'Bundle Size': `${metrics.bundleSize}KB`,
            'Resources': metrics.resourceCount,
            'Memory': `${metrics.memoryUsage}MB`,
          });
          console.log('💡 Use nabra.performance.measure() for current metrics');
          console.groupEnd();
        },
        help: () => {
          console.log('🆘 NABRA Performance Commands:');
          console.log('  nabra.performance.measure() - Measure current metrics');
          console.log('  nabra.performance.report() - Generate performance report');
          console.log('  nabra.performance.help() - Show this help');
        }
      }
    };

    console.log('🚀 NABRA Performance Monitor loaded!');
    console.log('Type nabra.performance.help() to see available commands');

  }, [metrics]);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 bg-black text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        {isVisible ? '📊 Hide' : '📊 Show'} Performance
      </button>

      {isVisible && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-64">
          <h3 className="font-semibold text-gray-800 mb-3">Performance Monitor</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Load Time:</span>
              <span className={metrics.loadTime < 2000 ? 'text-green-600' : metrics.loadTime < 4000 ? 'text-yellow-600' : 'text-red-600'}>
                {metrics.loadTime}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>Bundle Size:</span>
              <span className={metrics.bundleSize < 500 ? 'text-green-600' : metrics.bundleSize < 1000 ? 'text-yellow-600' : 'text-red-600'}>
                {metrics.bundleSize}KB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Resources:</span>
              <span>{metrics.resourceCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Memory:</span>
              <span>{metrics.memoryUsage}MB</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-200">
            <button
              onClick={() => {
                console.log('📊 Current Metrics:', {
                  'Load Time': `${metrics.loadTime}ms`,
                  'Bundle Size': `${metrics.bundleSize}KB`,
                  'Resources': metrics.resourceCount,
                  'Memory': `${metrics.memoryUsage}MB`,
                });
              }}
              className="w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
            >
              Log to Console
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


