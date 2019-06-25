const cacheVersion = 'mws-restaurant-static-v-2';
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
                "/css/styles.css",
                "/js/dbhelper.js",
                "/js/idb_util.js",
                "/js/main.js",
                "/js/restaurant_info.js",
                "/img/*",
                "service_worker.js",
                "manifest.json"
            ]).catch(error => {
                return error;
            });
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
    if (event.request.method !== "GET") {
        if (!navigator.onLine) {
            let init = {
                "status" : 303,
                "statusText" : "network error"
            };
            event.respondWith(new Response(null, init));
            return new Error("network connection failed");
        }
        event.respondWith(fetch(event.request).catch(err => {
            return err;
        }));
    } else {
        const url = new URL(event.request.url);
        if (url.port === "1337"){
            if (url.pathname.split("/").filter(path => path === "restaurants").length > 0) {
                const pathParts = url.pathname.split("/").filter(pathParam => Number(pathParam) > 0);
                if(pathParts.length > 0) {
                    getRestaurantById(event, Number(pathParts[0]));
                } else if (url.searchParams.get("is_favorite")) {
                    getFavoriteRestaurant(event);
                } else {
                    getRestaurants(event);
                }
            } else {
                const restaurantId = new URL(event.request.url).searchParams.get("restaurant_id");
                event.respondWith(updateReviews(event).then(json => {
                    json = JSON.stringify(json);
                    return new Response(json);
                }).catch(error=> {
                    return getReviews(restaurantId).then(data => {
                        data = JSON.stringify(data);
                        return new Response(data);
                    }).catch(error => {
                        return fetchCacheContent(event);
                    });
                }));
            }
        } else {
            return respondWithCache(event);
        }
    }
});

respondWithCache = (event) =>
    event.respondWith(fetchCacheContent(event));

fetchCacheContent = (event) =>
    caches.match(event.request).then(function(response) {
        if (response !== undefined) {
            return response;
        } else {
            if(!navigator.onLine) {
                return new Response(null, isMapContent(event)? {
                    "status": 200,
                    "statusText": "Waived map content"
                }: {
                    "status": 500,
                    "statusText" : "Not found in cache, network error"
                });
            }
            return fetch(event.request).then(function (response) {
                if(!isMapContent(event)){
                    let responseClone = response.clone();
                    caches.open(cacheVersion).then(function (cache){
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            });
        }
    });

isMapContent = (event) =>
    event.request.url.includes('api.tiles.mapbox.com');

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
    });

getReviews = restaurant_id =>
    dbPromise.then(objStore =>
        objStore.transaction('reviews')
            .objectStore('reviews')
            .index('restaurant_id')
            .getAll(Number.parseInt(restaurant_id))
    );

getFavoriteRestaurant = event => {
    event.respondWith(
        getStoredFavoriteRestaurant().then(data => {
            if (data.length > 0) {
                return new Response(JSON.stringify(data));
            }
            return fetchAndCacheRestaurants(event).then(json => {
                return new Response(JSON.stringify(json));
            });
        })
    );
};

getRestaurants = event => {
    event.respondWith(
        getStoredRestaurants().then(data => {
            if (data.length > 0) {
                return new Response(JSON.stringify(data));
            }
            return fetchAndCacheRestaurants(event).then(newdata => {
                return new Response(JSON.stringify(newdata));
            });
        })
    );
};

getRestaurantById = (event, id) => {
    event.respondWith(getStoredRestaurantById(id).then(data => {
        if (data && Object.keys(data).length !== 0 && data.constructor === Object) {
            return new Response(JSON.stringify(data));
        }
        return fetchAndCacheRestaurants(event).then(newdata => {
            return new Response(JSON.stringify(newdata));
        });
    }));
};

fetchAndCacheRestaurants = event => {
    return fetch(event.request).then(res =>
        res.json()
    ).then(json => {
        if (!Array.isArray(json)) {
            addRestaurants([json]);
        } else {
            addRestaurants(json);
        }
        return json;
    });
};

addRestaurants = new_restaurants =>
    dbPromise.then(objStore => {
        const store = objStore
            .transaction('restaurants', 'readwrite')
            .objectStore('restaurants');

        new_restaurants.map(restaurant => {
            store.put(restaurant);
        });
        return new_restaurants;
    });

getStoredRestaurants = () =>
    dbPromise.then(objStore =>
        objStore
            .transaction('restaurants')
            .objectStore('restaurants')
            .getAll()
    );

getStoredRestaurantById = id =>
    dbPromise.then(objStore =>
        objStore
            .transaction('restaurants')
            .objectStore('restaurants')
            .get(id)
    );

getStoredFavoriteRestaurant = () =>
    dbPromise.then(objStore =>
        objStore
            .transaction('restaurants')
            .objectStore('restaurants')
            .index('is_favorite')
            .get('true')
    );
