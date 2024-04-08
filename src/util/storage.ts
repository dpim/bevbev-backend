import { sql } from '@vercel/postgres';

interface Restaurant {
    id: number;
    fsq_id: string;
    name: string;
    owner: string;
    lat: number;
    lon: number;
    location: any;
    description: string;
    attributes: any;
    hours: any;
    menu: any;
    photos: any;
    type: any;
    queried_at: Date;
}

export async function createRestaurantTableIfNotExists(): Promise<void> {
    try {
        // Enable PostGIS extension if not already enabled
        await sql`
            CREATE EXTENSION IF NOT EXISTS postgis;
        `;

        // Create Restaurants table if not exists
        await sql`
            CREATE TABLE IF NOT EXISTS Restaurants (
                id SERIAL PRIMARY KEY,
                venue_type VARCHAR(255),
                fsq_id VARCHAR(255),
                name VARCHAR(255),
                owner VARCHAR(255),
                lat NUMERIC,
                lon NUMERIC,
                description TEXT,
                location JSONB,
                fsqid VARCHAR(255),
                attributes JSONB,
                hours JSONB,
                menu JSONB,
                photos JSONB,
                queried_at TIMESTAMP
            );
        `;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getStoredRestaurants(lat: number, lon: number, venueType: string): Promise<Restaurant[]> {
    try {
        await createRestaurantTableIfNotExists(); // Check and create table if not exists

        const currentTime: any = new Date();
        currentTime.setMinutes(Math.round(currentTime.getMinutes() / 30) * 30); // Round to the nearest 30 minutes

        // Calculate the distance using Haversine formula
        const result: any = await sql`
            SELECT *,
                   6371 * 2 * ASIN(SQRT(POWER(SIN((RADIANS(${lat}) - RADIANS(lat)) / 2), 2) + 
                   COS(RADIANS(${lat})) * COS(RADIANS(lat)) * POWER(SIN((RADIANS(${lon}) - RADIANS(lon)) / 2), 2))) AS distance
            FROM Restaurants 
            WHERE 
                6371 * 2 * ASIN(SQRT(POWER(SIN((RADIANS(${lat}) - RADIANS(lat)) / 2), 2) + 
                COS(RADIANS(${lat})) * COS(RADIANS(lat)) * POWER(SIN((RADIANS(${lon}) - RADIANS(lon)) / 2), 2))) <= 500 
                AND queried_at = ${currentTime}
                AND venue_type = ${venueType};
        `;

        // Extract and return just the rows from the result array
        return result.rows;
    } catch (error: any) {
        throw new Error(error.message);
    }
}


export async function storeRestaurants(restaurants: Restaurant[], venueType: string): Promise<{ result: string }> {
    try {
        if (restaurants.length === 0) {
            return { result: 'No restaurants to store' };
        }

        await createRestaurantTableIfNotExists();

        // Begin transaction
        await sql`BEGIN`;

        for (const restaurant of restaurants) {
            const { fsq_id, name, location, description = '', attributes = {}, hours = {}, menu = {}, photos = [] } = restaurant;
            await sql`
                INSERT INTO Restaurants (
                    venue_type, name, lat, lon, description, attributes, hours, menu, photos, queried_at
                ) VALUES (
                    ${venueType},
                    ${name},
                    ${location.lat},
                    ${location.lon},
                    ${description},
                    ${JSON.stringify(attributes)},
                    ${JSON.stringify(hours)},
                    ${JSON.stringify(menu)},
                    ${JSON.stringify(photos)},
                    NOW()
                )
            `;
        }

        // Commit transaction
        await sql`COMMIT`;

        return { result: 'Restaurants stored successfully' };
    } catch (error: any) {
        // Rollback in case of an error
        await sql`ROLLBACK`;
        throw new Error(error.message);
    }
}
