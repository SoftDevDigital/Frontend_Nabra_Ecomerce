// Comandos de consola para monitoreo de performance

declare global {
  interface Window {
    nabra: {
      performance: {
        measure: () => void;
        report: () => void;
        monitor: () => void;
        stop: () => void;
        export: () => void;
        stats: () => void;
        help: () => void;
      };
    };
  }
}

export function setupConsoleCommands() {
  if (typeof window === 'undefined') return;

  // Función para medir métricas actuales
  const measureMetrics = () => {
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
      bundleSize: `${(bundleSize / 1024).toFixed(1)}KB`,
      resourceCount,
      loadTime: navigation ? `${(navigation.loadEventEnd - navigation.loadEventStart).toFixed(0)}ms` : 'N/A',
      memoryUsage: 'memory' in performance ? `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB` : 'N/A',
    };

    console.log('📊 Current Metrics:', metrics);
    return metrics;
  };

  // Función para generar reporte completo
  const generateReport = () => {
    console.group('🚀 NABRA Performance Report');
    
    // Core Web Vitals
    console.log('📊 Core Web Vitals:');
    console.log('  LCP: Measuring... (check in a few seconds)');
    console.log('  FID: Measuring... (interact with the page)');
    console.log('  CLS: Measuring... (scroll and interact)');
    
    // Bundle Info
    const metrics = measureMetrics();
    console.log('📦 Bundle Info:', metrics);
    
    // Performance Tips
    console.log('💡 Performance Tips:');
    console.log('  - Use nabra.performance.monitor() to start real-time monitoring');
    console.log('  - Use nabra.performance.export() to download performance data');
    console.log('  - Use nabra.performance.stats() to see historical statistics');
    
    console.groupEnd();
  };

  // Función para monitoreo en tiempo real
  let monitoringInterval: NodeJS.Timeout | null = null;
  
  const startMonitoring = () => {
    if (monitoringInterval) {
      console.log('⚠️ Monitoring already active. Use nabra.performance.stop() to stop.');
      return;
    }

    console.log('🔄 Starting real-time performance monitoring...');
    console.log('📊 Metrics will be logged every 5 seconds');
    
    let measurementCount = 0;
    monitoringInterval = setInterval(() => {
      measurementCount++;
      console.log(`\n📊 Measurement #${measurementCount} (${new Date().toLocaleTimeString()}):`);
      measureMetrics();
    }, 5000);
  };

  const stopMonitoring = () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
      console.log('⏹️ Performance monitoring stopped');
    } else {
      console.log('⚠️ No monitoring active');
    }
  };

  // Función para exportar datos
  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: measureMetrics(),
      performanceEntries: performance.getEntriesByType('navigation'),
      resourceEntries: performance.getEntriesByType('resource'),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nabra-performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📁 Performance data exported successfully');
  };

  // Función para mostrar estadísticas
  const showStats = () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    // Calcular estadísticas de recursos
    const jsResources = resources.filter(r => r.name.includes('.js'));
    const cssResources = resources.filter(r => r.name.includes('.css'));
    const imageResources = resources.filter(r => r.name.match(/\.(jpg|jpeg|png|gif|webp|avif)$/));
    
    const stats = {
      'Total Resources': resources.length,
      'JavaScript Files': jsResources.length,
      'CSS Files': cssResources.length,
      'Images': imageResources.length,
      'Total Transfer Size': `${(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024).toFixed(1)}KB`,
      'Page Load Time': navigation ? `${(navigation.loadEventEnd - navigation.loadEventStart).toFixed(0)}ms` : 'N/A',
      'DOM Content Loaded': navigation ? `${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(0)}ms` : 'N/A',
      'First Byte': navigation ? `${(navigation.responseStart - navigation.requestStart).toFixed(0)}ms` : 'N/A',
    };

    console.table(stats);
  };

  // Función de ayuda
  const showHelp = () => {
    console.group('🆘 NABRA Performance Commands');
    console.log('Available commands:');
    console.log('  nabra.performance.measure()  - Measure current metrics');
    console.log('  nabra.performance.report()   - Generate full performance report');
    console.log('  nabra.performance.monitor()  - Start real-time monitoring');
    console.log('  nabra.performance.stop()     - Stop monitoring');
    console.log('  nabra.performance.export()   - Export performance data');
    console.log('  nabra.performance.stats()    - Show detailed statistics');
    console.log('  nabra.performance.help()     - Show this help');
    console.groupEnd();
  };

  // Configurar comandos globales
  window.nabra = {
    performance: {
      measure: measureMetrics,
      report: generateReport,
      monitor: startMonitoring,
      stop: stopMonitoring,
      export: exportData,
      stats: showStats,
      help: showHelp,
    },
  };

  // Mostrar mensaje de bienvenida
  console.log('🚀 NABRA Performance Monitor loaded!');
  console.log('Type nabra.performance.help() to see available commands');
  console.log('Type nabra.performance.report() to generate a performance report');
}




