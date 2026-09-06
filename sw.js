const CACHE_NAME = 'empanadazas-v5';

// ARCHIVOS CRÍTICOS EN RUTA ABSOLUTA (ALINEADOS AL MANIFEST)
const ASSETS_TO_CACHE = [
  '/empanadazaswidget/',
  '/empanadazaswidget/app.html',
  '/empanadazaswidget/manifest.json',
  '/empanadazaswidget/empanadazas-icon.png'
];

// 1. INSTALACIÓN: Guarda los archivos en el almacenamiento físico del celular
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

// 2. ACTIVACIÓN: Borra versiones viejas y toma el control inmediato
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

// 3. FETCH: Arranque instantáneo (Cache-First) compatible con Atajos y parámetros (?branch=...)
self.addEventListener('fetch', (event) => {
  // Solo procesar peticiones GET y esquemas HTTP/HTTPS válidos
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // A. MODO NAVEGACIÓN (Cuando el usuario abre la app o toca un atajo de sucursal)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // ignoreSearch: true es la clave para que ?branch=palermo abra app.html sin trabarse
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        
        // Petición a la red en segundo plano para refrescar caché silenciosamente
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

        // Si ya está guardada en el teléfono, arranca en 0ms
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no estaba en caché, espera a la red con rescate de emergencia absoluto
        return networkFetch.then(async (response) => {
          if (response) return response;

          const fallback = (await caches.match('/empanadazaswidget/app.html', { ignoreSearch: true })) || 
                           (await caches.match('/empanadazaswidget/'));
          if (fallback) return fallback;

          return new Response('Contenido temporalmente no disponible', {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
    );
    return;
  }

  // B. RESTO DE RECURSOS (Imágenes, iconos, tipografías)
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
