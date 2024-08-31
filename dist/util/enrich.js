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
    if (!results || results.length < NUM_RESULTS) {
        const newResults = await makeRequestAndCache(latitude, longitude, venueType);
        // Merge new results with existing results, preserving upvotes and downvotes
        results = mergeResults(results, newResults);
    }
    return results;
}
function mergeResults(storedResults, newResults) {
    const mergedResults = [...storedResults];
    newResults.forEach(newResult => {
        const existingIndex = mergedResults.findIndex(r => r.fsq_id === newResult.fsq_id);
        if (existingIndex === -1) {
            // Add new result with default upvotes and downvotes
            mergedResults.push({ ...newResult, upvotes: 0, downvotes: 0 });
        }
        else {
            // Update existing result, preserving upvotes and downvotes
            mergedResults[existingIndex] = {
                ...newResult,
                upvotes: mergedResults[existingIndex].upvotes,
                downvotes: mergedResults[existingIndex].downvotes
            };
        }
    });
    return mergedResults;
}
async function makeRequestAndCache(latitude, longitude, venueType) {
    let fsqResults = {};
    if (venueType === VenueType.coffee) {
        fsqResults = await findFsqCoffee(latitude, longitude);
    }
    else if (venueType === VenueType.drinks) {
        fsqResults = await findFsqDrinks(latitude, longitude);
    }
    const { storedRestaurants } = await storeRestaurants(fsqResults, venueType);
    return storedRestaurants ?? [];
}
