"use client";

import { useEffect, useState } from "react";

export default function PerformanceTest() {
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const runTests = () => {
      const results: string[] = [];
      
      // Test 1: Verificar que los comandos están disponibles
      if (typeof window !== 'undefined' && window.nabra?.performance) {
        results.push('✅ Comandos de consola disponibles');
      } else {
        results.push('❌ Comandos de consola no disponibles');
      }

      // Test 2: Verificar Performance Observer
      if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
        results.push('✅ Performance Observer disponible');
      } else {
        results.push('❌ Performance Observer no disponible');
      }

      // Test 3: Verificar métricas básicas
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        results.push('✅ Métricas de navegación disponibles');
      } else {
        results.push('❌ Métricas de navegación no disponibles');
      }

      // Test 4: Verificar recursos
      const resources = performance.getEntriesByType('resource');
      if (resources.length > 0) {
        results.push(`✅ ${resources.length} recursos cargados`);
      } else {
        results.push('❌ No se encontraron recursos');
      }

      // Test 5: Verificar memoria (si está disponible)
      if ('memory' in performance) {
        results.push('✅ Información de memoria disponible');
      } else {
        results.push('⚠️ Información de memoria no disponible');
      }

      setTestResults(results);
    };

    // Ejecutar tests después de 2 segundos
    const timer = setTimeout(runTests, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed top-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 max-w-sm">
      <h3 className="font-semibold text-gray-800 mb-2">Performance Test</h3>
      <div className="space-y-1 text-sm">
        {testResults.map((result, index) => (
          <div key={index} className="text-xs">
            {result}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Abre la consola y usa: nabra.performance.help()
      </div>
    </div>
  );
}


