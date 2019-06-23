const cacheVersion = 'mws-restaurant-static-v-3';
let dbPromise;

self.addEventListener("install", function(event) {
    importScripts('js/idb_util.js');
    dbPromise = idb.open("udacity-restaurant", 2);
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
    if (!navigator.onLine) {
        return respondWithCache(event);
    } else {
        const url = new URL(event.request.url);
        if (event.request.method === "GET" && url.port === "1337"){
            const restaurantId = url.searchParams.get("restaurant_id");
            let isReviewsRequest = url.pathname.split("/").filter(path => path === "reviews").length > 0;
            isReviewsRequest = isReviewsRequest && restaurantId;
            if(isReviewsRequest){
                event.respondWith(getReviews(restaurantId).then(data => {
                    return updateReviews(event).then(json => {
                        json = JSON.stringify(json);
                        return new Response(json);
                    }).catch(error => {
                        console.log(error);
                        return respondWithCache(event);
                    });
                }).catch(error => {
                    console.log(error);
                    return respondWithCache(event);
                }));
            } else {
                return respondWithCache(event);
            }
        } else {
            return respondWithCache(event);
        }
    }
});

respondWithCache = (event) =>
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

updateReviews = event =>
    fetch(event.request).then(res => {
        return res.json()
    }).then(reviews => {
        reviews = !Array.isArray(reviews)? [reviews]: reviews;
        dbPromise.then(objStore => {
            const store = objStore.transaction('reviews', "readwrite")
                .objectStore('reviews');
            reviews.map(review => store.put(review));
            return reviews;
        });
        return reviews;
    }).catch(error => {
        console.log(error);
        return error;
    });

getReviews = restaurant_id =>
    dbPromise.then(objStore =>
        objStore.transaction('reviews')
            .objectStore('reviews')
            .index('restaurant_id')
            .getAll(restaurant_id)
    );
