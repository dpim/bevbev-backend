import { findFsqCoffee, findFsqDrinks } from "./foursquare.js";
import { getStoredRestaurants, storeRestaurants } from "./storage.js";
import { NUM_RESULTS } from './constants.js';
export var VenueType;
(function (VenueType) {
    VenueType["drinks"] = "drinks";
    VenueType["coffee"] = "coffee";
})(VenueType || (VenueType = {}));
export async function getCachedOrFetch(latitude, longitude, venueType) {
    // check DB cache
    let results = await getStoredRestaurants(latitude, longitude, venueType);
    // if insufficient results, issue a new query
    console.log("results1 --> ", results.length);
    if (!results || results.length < NUM_RESULTS) {
        console.log("results2 --> ", results.length);
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
