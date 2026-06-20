// Service Worker v2 — 网络优先 + 自动清旧缓存
const CACHE_NAME = 'calendar-cache-v2';

// 仅缓存静态资源（不缓存 index.html，保证始终获取最新版本）
const urlsToCache = [
    './manifest.json'
];

self.addEventListener('install', function(event) {
    console.log('🔧 SW v2 安装中...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache).catch(function(e) {
                console.warn('SW 缓存失败（非关键）:', e);
            });
        })
    );
    // ★ 立即激活，不等待旧SW释放
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('🔧 SW v2 激活，清理旧缓存');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ 删除旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // ★ 立即控制所有页面
    self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    // ★ 仅对同源 GET 请求做处理
    if (event.request.method !== 'GET') return;

    var url = new URL(event.request.url);

    // ★ index.html 始终走网络（保证代码最新）
    if (url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request).catch(function() {
                // 网络失败时才回退缓存
                return caches.match(event.request);
            })
        );
        return;
    }

    // manifest.json 走缓存优先
    if (url.pathname.endsWith('manifest.json')) {
        event.respondWith(
            caches.match(event.request).then(function(cached) {
                return cached || fetch(event.request);
            })
        );
        return;
    }

    // 其他请求（API等）直接走网络
    event.respondWith(fetch(event.request));
});
