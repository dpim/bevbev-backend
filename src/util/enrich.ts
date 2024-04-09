import { findFsqCoffee, findFsqDrinks } from "./foursquare.js";
import { getStoredRestaurants, storeRestaurants } from "./storage.js";
import { NUM_RESULTS } from './constants.js';

export enum VenueType { 
    drinks = "drinks",
    coffee = "coffee"
}

export async function getCachedOrFetch(latitude: number, longitude: number, venueType: VenueType){
    // check DB cache
    let results = await getStoredRestaurants(latitude, longitude, venueType)
    // if insufficient results, issue a new query
    console.log("results1 --> ", results.length)
    
    if (!results || results.length < NUM_RESULTS){
        console.log("results2 --> ", results.length)
        results = await makeRequestAndCache(latitude, longitude, venueType);
    }
    // return
    return results;
}

async function makeRequestAndCache(latitude: number, longitude: number, venueType: VenueType){
    let fsqResults: any = {};
    if (venueType === "coffee"){
        fsqResults = await findFsqCoffee(latitude, longitude);
    } else if (venueType === "drinks"){
        fsqResults = await findFsqDrinks(latitude, longitude);
    }

    await storeRestaurants(fsqResults, venueType);
    return fsqResults ?? [];
}