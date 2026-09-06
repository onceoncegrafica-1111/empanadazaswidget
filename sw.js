const CACHE_NAME = 'empanadazas-v4';

// ARCHIVOS CRÍTICOS QUE SE GUARDAN EN EL TELÉFONO DE INMEDIATO
const ASSETS_TO_CACHE = [
  './',
  './app.html',
  './manifest.json',
  './empanadazas-icon.png'
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

// 3. FETCH: Arranque instantáneo (Cache-First) con actualización en segundo plano
self.addEventListener('fetch', (event) => {
  // Solo procesar peticiones GET y esquemas HTTP/HTTPS válidos
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // A. SI EL USUARIO ESTÁ ABRIENDO LA APP (Navegación / Arranque):
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Petición a la red en segundo plano para mantener la app actualizada
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

        // Si ya está guardada en el celular, ARRANCAR EN 0ms (sin parpadeo ni espera)
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si es la primera vez que entra y no estaba en caché, esperar a la red
        return networkFetch.then(async (response) => {
          if (response) return response;

          // Rescate de emergencia: si la red titubea, servir app.html o la raíz
          const fallback = (await caches.match('./app.html')) || (await caches.match('./'));
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

  // B. PARA EL RESTO DE RECURSOS (Imágenes, íconos, tipografías):
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Si está en caché lo entrega y actualiza silenciosamente de fondo
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

      // Si no estaba en caché, va a internet
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
