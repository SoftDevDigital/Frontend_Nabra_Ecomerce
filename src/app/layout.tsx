// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AnnouncementBar from "./components/AnnouncementBar/AnnouncementBar";
import Header from "./components/Header/Header";
import WhatsAppFloat from "./components/WhatsAppFloat/WhatsAppFloat";
// import SimplePerformanceMonitor from "./components/Performance/SimplePerformanceMonitor";

export const metadata: Metadata = {
  title: "NABRA | Calzado",
  description: "Pasos que inspiran, zapatos que enamoran.",
  icons: { icon: "/logoNabra.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* 🚀 PRELOAD DE IMÁGENES CRÍTICAS */}
        <link rel="preload" href="/zapateria.jpeg" as="image" />
        <link rel="preload" href="/logoNabra.png" as="image" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <meta name="theme-color" content="#f7f2e9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NABRA" />
        <link rel="apple-touch-icon" href="/logoNabra.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        {/* Script de monitoreo simple */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Configurar comandos de consola
                window.nabra = {
                  performance: {
                    measure: function() {
                      const resources = performance.getEntriesByType('resource');
                      const navigation = performance.getEntriesByType('navigation')[0];
                      let bundleSize = 0;
                      let resourceCount = 0;
                      resources.forEach(resource => {
                        if (resource.name.includes('_next/static')) {
                          resourceCount++;
                          bundleSize += resource.transferSize || 0;
                        }
                      });
                      console.log('📊 Current Metrics:', {
                        'Load Time': navigation ? (navigation.loadEventEnd - navigation.loadEventStart).toFixed(0) + 'ms' : 'N/A',
                        'Bundle Size': (bundleSize / 1024).toFixed(1) + 'KB',
                        'Resources': resourceCount,
                        'Memory': 'memory' in performance ? ((performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB') : 'N/A',
                      });
                    },
                    report: function() {
                      console.group('🚀 NABRA Performance Report');
                      console.log('📊 Metrics: Use nabra.performance.measure() for current metrics');
                      console.log('💡 The image should load immediately now!');
                      console.groupEnd();
                    },
                    help: function() {
                      console.log('🆘 NABRA Performance Commands:');
                      console.log('  nabra.performance.measure() - Measure current metrics');
                      console.log('  nabra.performance.report() - Generate performance report');
                      console.log('  nabra.performance.help() - Show this help');
                    }
                  }
                };
                console.log('🚀 NABRA Performance Monitor loaded!');
                console.log('Type nabra.performance.help() to see available commands');
              }
            `,
          }}
        />
        
        <AnnouncementBar />
        <Header />
        {children}

        {/* 👇 Botón flotante global */}
        <WhatsAppFloat
          phone="523312442370"              // 👈 número en formato internacional (52 + 3312442370)
          message="¡Hola Nabra! Quisiera consultar por un producto."
          side="right"
          offset={16}
        />
      </body>
    </html>
  );
}
