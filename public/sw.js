/*
 * Service Worker básico — Nós Dois
 *
 * Regras de segurança:
 *  - NUNCA guarda em cache respostas da API do Supabase (dados privados do casal).
 *  - Só faz cache de assets estáticos públicos (/_next/static, ícones, manifest).
 *  - Páginas: sempre rede primeiro; offline mostra /offline.html.
 */
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const PRECACHE = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // só mesma origem; Supabase (outra origem) passa direto, sem cache
  if (url.origin !== self.location.origin) return;

  // Navegação (HTML): rede primeiro, fallback offline. HTML não é cacheado (contém dados do usuário).
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // Assets estáticos versionados: cache primeiro
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
