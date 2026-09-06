const CACHE_NAME = 'empanadazas-v10';

// ARCHIVOS CRÍTICOS EN RUTA ABSOLUTA
const ASSETS_TO_CACHE = [
  '/empanadazaswidget/',
  '/empanadazaswidget/index.html',
  '/empanadazaswidget/app.html',
  '/empanadazaswidget/wpp.html',
  '/empanadazaswidget/manifest.json',
  '/empanadazaswidget/empanadazas-icon.png'
];

// 1. INSTALACIÓN INMEDIATA
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

// 2. ACTIVACIÓN Y LIMPIEZA TOTAL DE VERSIONES VIEJAS
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

// 3. ESTRATEGIA INTELIGENTE: NETWORK-FIRST PARA PANTALLAS + CACHE-FIRST PARA IMÁGENES
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // A. NAVEGACIÓN (app.html, index.html, wpp.html): SIEMPRE BUSCA LO ÚLTIMO EN INTERNET
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si el usuario no tiene internet, recurre al caché para no fallar
          return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/empanadazaswidget/app.html', { ignoreSearch: true });
          });
        })
    );
    return;
  }

  // B. RECURSOS GRÁFICOS (Imágenes, iconos, fuentes): CACHE ULTRA RÁPIDO
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

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
