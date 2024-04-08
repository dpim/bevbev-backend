import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();
// const FOURSQUARE_CLIENT_ID = process.env.FOURSQUARE_CLIENT_ID;
// const FOURSQUARE_CLIENT_SECRET = process.env.FOURSQUARE_CLIENT_SECRET;
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
// cafe - 13034
// bar - 13009
export async function findFsqCoffee(lat, lon) {
    // const coffeeShopCategoryId = "4bf58dd8d48988d1e0931735";
    return findFourSqVenues(lat, lon, "cafe", "13034");
}
export async function findFsqDrinks(lat, lon) {
    // const barCategoryId = "4bf58dd8d48988d116941735"
    return findFourSqVenues(lat, lon, "bar", "13009");
}
async function findFourSqVenues(lat, lon, query, categoryId) {
    const radius = 1000;
    const limit = 5; // Number of results
    const url = new URL('https://api.foursquare.com/v3/places/search');
    const accessToken = FOURSQUARE_API_KEY;
    url.searchParams.append('query', query);
    url.searchParams.append('ll', `${lat},${lon}`);
    url.searchParams.append('radius', `${radius}`);
    url.searchParams.append('categories', categoryId);
    url.searchParams.append('exclude_all_chains', 'true');
    url.searchParams.append('open_now', 'true');
    url.searchParams.append('fields', 'fsq_id,categories,distance,description,features,features,hours,location,link,menu,name,photos,popularity,price,rating');
    url.searchParams.append('limit', `${limit}`);
    try {
        console.log('Fetching data...');
        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `${accessToken}`
            }
        });
        const data = await response.json();
        console.log('Parsed data:', data);
        if (!response.ok) {
            throw new Error('Response not OK');
        }
        // const data: any = await response.json();
        // console.log('Parsed data:', data);
        if (data.results) {
            return data.results.map((result) => ({
                fsq_id: result.fsq_id,
                name: result.name,
                distance: result.distance,
                description: result.description,
                link: result.link,
                location: result.location,
                categories: result.categories,
                features: result.features,
                hours: result.hours,
                price: result.price,
                rating: result.rating,
                address: result.location.address || 'Address not available',
            }));
        }
        throw new Error('No venues found');
    }
    catch (error) {
        console.error('Error fetching or parsing data:', error);
        throw error;
    }
}
// // Function calls for coffee shops and bars
// (async () => {
//     const coffeeShops = await findFsqCoffee(40.7128, -74.0060);
//     console.log("Coffee Shops:", coffeeShops);
// })();
// (async () => {
//     const bars = await findFsqDrinks(40.7128, -74.0060);
//     console.log("Bars:", bars);
// })();
