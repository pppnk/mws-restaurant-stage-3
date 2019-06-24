const idbStore = (function() {
  'use strict';

  if (!('indexedDB' in window)) {
    console.log('This browser does not support IndexedDB');
    return;
  }

  /**
   * Init IndexDB store
   * */
  const dbPromise = idb.open("udacity-restaurant", 2, upgradeDB => {
    switch (upgradeDB.oldVersion) {
      case 0:
        upgradeDB.createObjectStore("restaurants", {keyPath: "id"});
      case 1:
        upgradeDB.createObjectStore("reviews", { keyPath: "id" })
            .createIndex("restaurant_id", "restaurant_id");
        upgradeDB.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
    }
  });

  function fetchAndStore(urlPostFix, transactionStore){
    fetch(DBHelper.DATABASE_URL + urlPostFix).then(function (response) {
      return response.clone().json();
    }).then(function(response){
      dbPromise.then(function (db) {
        if (!db) return;
        var tx = db.transaction(transactionStore, 'readwrite');
        var store = tx.objectStore(transactionStore);
        response.forEach(function (item) {
          store.put(item)
        });
      });
      callback(null, response);
    }).catch(function (err) {
      const error = (`Unable to store ${transactionStore} data ${err}`);
      return error;
    });
  }

  return {
    dbPromise: (dbPromise),
    fetchAndStore: (fetchAndStore)
  };
})();

/**
 * Add a listener to process all the pending requests
 * */
window.addEventListener("load", event => {
  if (!navigator.onLine) {
    window.addEventListener('online', event => {
      const notification = document.createElement("section");
      const message = document.createElement("p");
      DBHelper.sendPendingRequests();
      message.innerHTML = 'Synchronized pending requests.';
      notification.appendChild(message);
      document.getElementById("maincontent").appendChild(notification);
    });
  } else {
    DBHelper.sendPendingRequests();
  }
});

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}`;
  }

  static getRestaurants(){
    return idbStore.dbPromise.then(function(db) {
      var tx = db.transaction('restaurants', 'readonly');
      var store = tx.objectStore('restaurants');
      return store.getAll();
    });
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    const fetchURL= DBHelper.DATABASE_URL + '/restaurants';
    this.getRestaurants().then(function(restaurants){
      return restaurants;
    });
    fetch(fetchURL, {method: "GET"}).then(response => {
      response
          .clone()
          .json()
          .then(
              (restaurants) => callback(null, restaurants)
          );
    }).catch(error => {
      callback(`Request failed: ${error.message}`, null);
    });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Sets the favorite status for a restaurant
   * */
  static setFavorite(id, markAsFavorite, restaurant) {
    restaurant.is_favorite = markAsFavorite;
    idbStore.dbPromise.then(function(db) {
        let transaction = db.transaction('restaurants', 'readwrite');
        let store = transaction.objectStore('restaurants');
        console.log('Will update favorite to ' + restaurant.is_favorite);
        store.put(restaurant);
    });
    return this.putRequest(`${DBHelper.DATABASE_URL}/restaurants/${id}/?is_favorite=${markAsFavorite}`).then(response => {
        return restaurant;
    }).catch(error => {
      console.log('Error while adding favorite: ' + error);
      // Adds the request to the pending queue
      const pendingRequest = {
        foreignKey: id,
        foreignStore: 'pending',
        method: "PUT",
        url: `${DBHelper.DATABASE_URL}/restaurants/${id}/?is_favorite=${markAsFavorite}`,
        body: {}
      };
      idbStore.dbPromise.then(objStore => {
        const store = objStore.transaction('pending', 'readwrite')
            .objectStore('pending');
        store.put(pendingRequest);
      }).then(pending => pending).catch(err => err);
      return restaurant;
    });
  }

  /**
   * Sets the favorite element properties and calls to set/unset a favorite restaurant
   * */
  static setFavoriteButtonProperties(favoriteButton, restaurant) {
    favoriteButton.setAttribute('aria-label', 'Mark as favorite button');
    favoriteButton.className = 'favorite-control';
    if (restaurant.is_favorite === 'true' || restaurant.is_favorite === true) {
      favoriteButton.classList.add('active');
      favoriteButton = DBHelper.setFavoriteAttributes(restaurant, favoriteButton, 'true', 'Unmark');
    } else {
      favoriteButton = DBHelper.setFavoriteAttributes(restaurant, favoriteButton, 'false', 'Mark');
    }
    favoriteButton.addEventListener('click', (event) => {
      event.preventDefault();
      const isFavorite = restaurant.is_favorite === 'true' || restaurant.is_favorite === true;
      const prefix = isFavorite? 'Unmark': 'Mark';
      favoriteButton = DBHelper.setFavoriteAttributes(restaurant, favoriteButton, `${!isFavorite}`, prefix);
      DBHelper.setFavorite(restaurant.id, !isFavorite, restaurant).then(updatedRestaurant => {
          restaurant = updatedRestaurant;
      });
      favoriteButton.classList.toggle('active');
    });
    return favoriteButton;
  }

  static setFavoriteAttributes = (restaurant, element, pressed, textPrefix) => {
    element.setAttribute('aria-pressed', `${pressed}`);
    element.innerHTML = `${textPrefix} ${restaurant.name} as a favorite`;
    element.title = `${textPrefix} ${restaurant.name} as a favorite`;
    return element;
  };

  /**
   * Fetch reviews by restaurant ID
   */
  static getReviewsByRestaurant(id, callback) {
    fetch(`${DBHelper.DATABASE_URL}/reviews/?restaurant_id=${id}`).then(response => {
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      callback(null, response.json());
    }).catch(err => {
      callback(err, null);
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    const fetchURL= DBHelper.DATABASE_URL + '/restaurants';
    this.getRestaurants().then(restaurants => this.getNeighborhoods(restaurants));
    fetch(fetchURL, {method: "GET"}).then(response => {
      response.json().then(restaurants => {
            idbStore.fetchAndStore('/restaurants', 'restaurants');
            callback(null, this.getNeighborhoods(restaurants));
      });
    }).catch(error => {
      callback(`Request failed: ${error.message}`, null);
    });
  }

  static getNeighborhoods(restaurants){
    const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
    return neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurantId) {
    return {
      'src': `/img/${restaurantId}.jpg`,
      'sizes': `(max-width: 570px) , (max-width: 800px) , (max-width: 1600px)`,
      'srcset': `/img/${restaurantId}-400_small.jpg 400w, /img/${restaurantId}-800_medium.jpg, /img/${restaurantId}-1600_large.jpg`
    };
  }

  /**
   * When online sends the pending requests stored in IndexedDB
   * */
  static async sendPendingRequests() {
    await this.processPendingRequests();
  }

  static processPendingRequests(){
    idbStore.dbPromise.then(objStore => objStore.transaction('pending')
        .objectStore('pending')
        .getAll()
    ).then(pendingRequests => {
      if (!pendingRequests || pendingRequests.length < 1) {
        return;
      }
      pendingRequests.map(pendingRequest => {
        const request = new Request(pendingRequest.url, {
          method: pendingRequest.method,
          body: JSON.stringify(pendingRequest.body)
        });
        fetch(request).then(response => {
          if (!response.ok){
            return;
          }
          idbStore.dbPromise.then(objStore => {
            const store = objStore.transaction('pending', 'readwrite')
                .objectStore('pending');
            store.delete(pendingRequest.id);
          });
          return response.clone().json();
        }).then(entry => {});
      });
    });
  }

  /**
   * Add the review
   * */
  static addReview(review, callback) {
    const idbReview = { ...review };
    idbStore.dbPromise.then(objStore => {
      const store = objStore.transaction("reviews", "readwrite")
                            .objectStore("reviews");
      store.put(idbReview);
      return idbReview;
    }).then(storedReview => {
      DBHelper.postRequest(DBHelper.DATABASE_URL + '/reviews', review).then(response => {
        if (!response || typeof(response) == 'undefined' || !response.ok) {
          const pendingReview = {
            foreignKey: storedReview.id,
            foreignStore: 'pending',
            method: "POST",
            url: DBHelper.DATABASE_URL + '/reviews',
            body: review
          };
          idbStore.dbPromise.then(objStore => {
            const store = objStore.transaction('pending', 'readwrite')
                                  .objectStore('pending');
            store.put(pendingReview);
            return idbReview;
          }).then(pending => {
            callback(pending, response);
          }).catch(err => {
            callback(err, null);
          });
        } else {
          callback(idbReview, null);
        }
      });
    }).catch(err => {
      callback(err, null);
    });
  }

  /**
   * Post Request
   * */
  // Post the Review to the Restful Server
  static postRequest(url = "", data = {}) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(data)
    }).then(response => {
          if (!response.ok || response.status > 300) {
            throw new Error(response.statusText);
          }
          return response;
    }).catch(error => {
      return error;
    });
  }

  /**
   * Put Request
   * */
  // Put the Review to the Restful Server
  static putRequest(url = "") {
    return new Promise(function(resolve, reject) {
      fetch(url, {method: 'PUT'})
          .then(() => {
            resolve(true);
          })
          .catch((err) => {
            return err;
          });
    });
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker  
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
      });
      marker.addTo(newMap);
    return marker;
  }
  /* static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  } */

}

