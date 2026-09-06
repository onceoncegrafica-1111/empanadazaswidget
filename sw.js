const CACHE_NAME = 'empanadazas-v7';

// ARCHIVOS CRÍTICOS EN RUTA ABSOLUTA (SIN REDIRECCIONES DE RAÍZ)
const ASSETS_TO_CACHE = [
  '/empanadazaswidget/app.html',
  '/empanadazaswidget/manifest.json',
  '/empanadazaswidget/empanadazas-icon.png'
];

// 1. INSTALACIÓN
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Advertencia en precaché:', err);
      });
    })
  );
});

// 2. ACTIVACIÓN
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// 3. FETCH: Compatible con Atajos y parámetros (?branch=...)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // A. MODO NAVEGACIÓN (Cuando abren la app o usan atajos)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).catch(() => {});
              });
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cachedResponse) {
          return cachedResponse;
        }

        // Rescate de emergencia usando Promesas puras (Sin async/await interno)
        return networkFetch.then((response) => {
          if (response) return response;

          return caches.match('/empanadazaswidget/app.html', { ignoreSearch: true })
            .then((fallback) => {
              if (fallback) return fallback;

              return new Response('Contenido temporalmente no disponible', {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            });
        });
      })
    );
    return;
  }

  // B. RESTO DE RECURSOS (Imágenes, iconos, etc.)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      return new Response('', { status: 408 });
    })
  );
});
