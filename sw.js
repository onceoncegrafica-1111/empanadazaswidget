const CACHE_NAME = 'empanadazas-v3';

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

// 3. FETCH: Estrategia Network-First con Rescate Infalible
self.addEventListener('fetch', (event) => {
  // Solo procesar peticiones GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si hay internet, actualiza la copia local en segundo plano
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // SI EL INTERNET TITUBEA O FALLA: Usa la copia local guardada
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si intentaba abrir la app o navegar y no hay red, sirve app.html siempre
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./app.html');
          if (fallback) return fallback;
        }

        // Respuesta limpia de emergencia para que Android NUNCA cierre la app
        return new Response('Contenido temporalmente no disponible', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
