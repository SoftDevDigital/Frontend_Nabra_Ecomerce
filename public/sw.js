// Service Worker para cache busting automático
const CACHE_NAME = 'nabra-ecommerce-v1';
const VERSION_CHECK_INTERVAL = 30000; // 30 segundos

// Archivos que siempre deben ser cacheados
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

// Archivos que nunca deben ser cacheados
const NO_CACHE_URLS = [
  '/api/version',
  '/api/',
  '/sw.js'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache abierto');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker instalado correctamente');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Error instalando Service Worker:', error);
      })
  );
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear APIs ni Service Worker
  if (NO_CACHE_URLS.some(pattern => url.pathname.startsWith(pattern))) {
    event.respondWith(
      fetch(request, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    );
    return;
  }

  // Estrategia: Network First para HTML, Cache First para assets
  if (request.destination === 'document') {
    // Para páginas HTML: Network First
    event.respondWith(
      fetch(request, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      .then((response) => {
        // Si la respuesta es exitosa, actualizar cache
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde cache
        return caches.match(request);
      })
    );
  } else {
    // Para assets estáticos: Cache First
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
            // Solo cachear respuestas exitosas
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
  }
});

// Verificar actualizaciones periódicamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    checkForUpdates();
  }
});

// Función para verificar actualizaciones
async function checkForUpdates() {
  try {
    const response = await fetch('/api/version', {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔄 Verificando versión:', data.version);
      
      // Notificar a todos los clientes sobre la verificación
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'VERSION_CHECK',
          version: data.version,
          timestamp: data.timestamp
        });
      });
    }
  } catch (error) {
    console.warn('⚠️ Error verificando actualizaciones:', error);
  }
}

// Verificar actualizaciones cada 30 segundos
setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);

console.log('🎯 Service Worker cargado y funcionando');


