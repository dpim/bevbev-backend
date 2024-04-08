import { findFsqCoffee, findFsqDrinks } from "./foursquare.js";
import { getStoredRestaurants, storeRestaurants } from "./storage.js";
export var VenueType;
(function (VenueType) {
    VenueType["drinks"] = "drinks";
    VenueType["coffee"] = "coffee";
})(VenueType || (VenueType = {}));
export async function getCachedOrFetch(latitude, longitude, venueType) {
    // check DB cache
    let results = await getStoredRestaurants(latitude, longitude, venueType);
    // if insufficient results, issue a new query
    if (!results || results.length < 5) {
        results = await makeRequestAndCache(latitude, longitude, venueType);
    }
    // return
    return results;
}
async function makeRequestAndCache(latitude, longitude, venueType) {
    let fsqResults = {};
    if (venueType === "coffee") {
        fsqResults = await findFsqCoffee(latitude, longitude);
    }
    else if (venueType === "drinks") {
        fsqResults = await findFsqDrinks(latitude, longitude);
    }
    await storeRestaurants(fsqResults, venueType);
    return fsqResults ?? [];
}
