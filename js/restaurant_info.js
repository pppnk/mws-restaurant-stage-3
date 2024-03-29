let restaurant;
let restaurantId;
var newMap;

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {  
  initMap();
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {      
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
        mapboxToken: 'pk.eyJ1IjoicHBwbmsiLCJhIjoiY2pzNnY5Zzk3MHVrOTQ5cGJxNmU2emxlZyJ9.eR9hB8Jx5jdCLv3TNRomLw',
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
          '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
          'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'    
      }).addTo(newMap);
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
};
 
/* window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
} */

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL';
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  restaurantId = restaurant.id;

  const imageSources = DBHelper.imageUrlForRestaurant(restaurant.id);
  image.src = imageSources.src;
  image.srcset = imageSources.srcset;
  image.sizes = imageSources.sizes;
  image.alt = `Photo of ${restaurant.name} restaurant`;
  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;
  let favoriteButton = document.getElementById('restaurant-favorite');
  favoriteButton = DBHelper.setFavoriteButtonProperties(favoriteButton, restaurant);
  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
};

setFavoriteAttributes = (restaurant, element, pressed, textPrefix) => {
  element.setAttribute('aria-pressed', `${pressed}`);
  element.innerHTML = `${textPrefix} ${restaurant.name} as a favorite`;
  element.title = `${textPrefix} ${restaurant.name} as a favorite`;
  return element;
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-content');
  // Get all Reviews
  DBHelper.getReviewsByRestaurant(self.restaurant.id, (error, reviews) => {
    if (error){
      return;
    }
    if (!reviews) {
      const noReviews = document.createElement('p');
      noReviews.innerHTML = 'No reviews yet!';
      container.appendChild(noReviews);
      return;
    }
    const ul = document.getElementById('reviews-list');
    reviews.then(results => {
      if(!results || !results.length) {
        errorElement.innerHTML = 'No reviews yet!';
        container.appendChild(errorElement);
      } else {
        results.forEach(result => {
          ul.appendChild(createReviewHTML(result));
        });
      }
    }).catch(error => {
      errorElement.innerHTML = 'Error while retrieving reviews';
      container.appendChild(errorElement);
    });
    container.appendChild(ul);
  });
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  let dateValue = new Date(review.updatedAt || review.createdAt);
  date.innerHTML = dateValue.toGMTString();
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

function validateFormOnSubmit(event) {
  const errorsSection = document.getElementById("review-form-errors-section");
  const errors = document.getElementById("review-form-errors");
  let name = document.getElementById("name").value;
  let comment = document.getElementById("comment").value;
  const rating = document.getElementById("rating").value;
  name = name.trim();
  comment = comment.trim();

  let errorMessage = '';
  let validForm = true;
  if(!name || !name.length || name.length < 5){
    validForm = false;
    errorMessage += 'You must enter a valid name (at least 5 characters)\n';
  }
  if(!comment || !comment.length || comment.length < 5){
    validForm = false;
    errorMessage += 'You must enter a comment at least 5 characters long\n';
  }
  errors.innerText = errorMessage;
  if(validForm){
    // event.preventDefault();
    handleFormSubmit(restaurantId, name, comment, rating);
    errorsSection.style.display = 'none';
  } else {
    errorsSection.style.display = 'flex';
  }
  return false;
}

function handleFormSubmit(restaurantId, name, comment, rating){
  const ul = document.getElementById('reviews-list');
  const review = {
    id: Date.now(),
    restaurant_id: restaurantId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: name,
    comments: comment,
    rating: rating
  };
  DBHelper.addReview(review, (review, error) => {
    if (!review || error) {
      console.log("Error while adding review");
    }
    ul.appendChild(createReviewHTML(review));
    document.getElementById("add-review").reset();
  });
}
