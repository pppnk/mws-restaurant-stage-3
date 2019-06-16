const cacheVersion = 'mws-restaurant-static-v-3';


self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(cacheVersion).then(function(cache) {
            return cache.addAll([
                "/",
                "index.html",
                "restaurant.html",
                "/css/main.css",
                "/css/responsive.css",
                "/js/dbhelper.js",
                "/js/main.js",
                "/js/restaurant_info.js",
                "/js/idb_util.js",
                "/js/service_worker.js",
                "/img/*"
            ]).catch(error => {});
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(cacheName) {
                    return cacheName.startsWith('mws-restaurant-') && cacheName !== cacheVersion;
                }).map(function(cacheName) {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith (
        caches.match(event.request).then(function(response) {
            if (response !== undefined) {
                return response;
            } else {
                return fetch(event.request).then(function (response) {
                    let responseClone = response.clone();
                    caches.open(cacheVersion).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            }
        })
    );
});