import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface Place {
    name: string;
    address: string;
}

export async function findPlaces(lat: number, lon: number, type: 'coffee' | 'bar'): Promise<Place[]> {
    const radius = 20000;
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.append('location', `${lat},${lon}`);
    url.searchParams.append('radius', `${radius}`);
    url.searchParams.append('type', type);
    url.searchParams.append('key', GOOGLE_PLACES_API_KEY || '');

    try {
        const response = await fetch(url.toString());
        const data: any = await response.json();
        console.log(data)
        if (data.results) {
            return data.results.map((place: any) => ({
                name: place.name,
                address: place.vicinity,
            }));
        }
        throw new Error('No results found');
    } catch (error) {
        console.error('Error fetching places:', error);
        throw error;
    }
}