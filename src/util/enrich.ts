import { findFsqCoffee, findFsqDrinks } from "./foursquare.js";
import { getStoredRestaurants, storeRestaurants } from "./storage.js";
import { NUM_RESULTS } from './constants.js';

export enum VenueType { 
    drinks = "drinks",
    coffee = "coffee"
}

export async function getCachedOrFetch(latitude: number, longitude: number, venueType: VenueType, query: string | null = null){
   
    // query can be "cozy" or "patio"

    // check DB cache
    let results = await getStoredRestaurants(latitude, longitude, venueType, query)
    
    if (!results || results.length < NUM_RESULTS){
        const newResults = await makeRequestAndCache(latitude, longitude, venueType, query);
        // Merge new results with existing results, preserving upvotes and downvotes
        results = mergeResults(results, newResults);
    }
    
    return results;
}

function mergeResults(storedResults: any[], newResults: any[]): any[] {
    const mergedResults = [...storedResults];
    
    newResults.forEach(newResult => {
        const existingIndex = mergedResults.findIndex(r => r.id === newResult.id);
        if (existingIndex === -1) {
            // Add new result with default upvotes and downvotes
            mergedResults.push({...newResult, upvotes: 0, downvotes: 0});
        } else {
            // Update existing result, preserving upvotes and downvotes
            mergedResults[existingIndex] = {
                ...newResult,
                upvotes: mergedResults[existingIndex].upvotes || 0,
                downvotes: mergedResults[existingIndex].downvotes || 0
            };
        }
    });
    
    return mergedResults;
}

async function makeRequestAndCache(latitude: number, longitude: number, venueType: VenueType, query: string | null = null){
    let fsqResults: any = {};
    if (venueType === VenueType.coffee){
        fsqResults = await findFsqCoffee(latitude, longitude, query);
    } else if (venueType === VenueType.drinks){
        fsqResults = await findFsqDrinks(latitude, longitude, query);
    }

    const { storedRestaurants } = await storeRestaurants(fsqResults, venueType);
    return storedRestaurants ?? [];
}