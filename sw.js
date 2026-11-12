/* 私人工作台 · Service Worker
 * 策略：外壳缓存优先（App Shell 离线可用），静态资源网络优先 + 失败回退缓存。
 * 应用用 hash 路由，所有页面都走 index.html，离线只需缓存 shell 即可整站可用。
 */
const CACHE = 'pw-shell-v6';
const SHELL = [
  './',
  './index.html',
  './config.js',
  './backup-codec.js',
  './store.js',
  './app.js',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Authenticated records/files must never enter the public app-shell cache.
  if (url.pathname.startsWith('/api/')) return;

  // 导航请求 → 网络优先，失败回退缓存的 index.html（离线整站可用）
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源 → 缓存优先，未命中走网络并回填缓存
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
