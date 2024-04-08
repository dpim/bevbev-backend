import { findFsqCoffee, findFsqDrinks } from "./foursquare.js";
import { getStoredRestaurants, storeRestaurants } from "./storage.js";

export enum VenueType { 
    drinks = "drinks",
    coffee = "coffee"
}

export async function getCachedOrFetch(latitude: number, longitude: number, venueType: VenueType){
    // check DB cache
    let results = await getStoredRestaurants(latitude, longitude, venueType)
    // if insufficient results, issue a new query
    if (!results || results.length < 5){
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