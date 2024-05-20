import { sql } from '@vercel/postgres';
import { MAX_DISTANCE, NUM_RESULTS } from './constants.js';
import { clear } from 'console';

interface Restaurant {
    id: number;
    fsq_id: string;
    name: string;
    owner: string;
    geocodes: any;
    location: any;
    description: string;
    attributes: any;
    hours: any;
    menu: any;
    photos: any;
    type: any;
    queried_at: Date;
}

async function clearTable(): Promise<void> {
    await sql`
        TRUNCATE TABLE Restaurants RESTART IDENTITY CASCADE;
    `;
}

async function addUniqueConstraint(): Promise<void> {
    await sql`
    ALTER TABLE Restaurants ADD CONSTRAINT unique_lat_lon_name UNIQUE (lat, lon, name);
    `;
}

export async function createRestaurantTableIfNotExists(): Promise<void> {
    try {
        // await clearTable();
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

export async function getStoredRestaurants(lat: number, lon: number, venueType: string): Promise<any[]> {

    try {
        // await createRestaurantTableIfNotExists(); // Ensure the table exists

        const currentTime = new Date();
        currentTime.setMinutes(Math.round(currentTime.getMinutes() / 30) * 30); // Round to the nearest 30 minutes
        const currentDay = currentTime.getDay() + 1; // Get current day of week (1=Sunday, 7=Saturday)
        const formattedTime = `${currentTime.getHours().toString().padStart(2, '0')}${currentTime.getMinutes().toString().padStart(2, '0')}`; // 'HHMM' format

        // Serialize your object to a JSON string
        const hoursJson = JSON.stringify({ day: currentDay, open: formattedTime, close: formattedTime });

        const result = await sql`
            SELECT *,
                6371 * 2 * ASIN(SQRT(POWER(SIN((RADIANS(${lat}) - RADIANS(lat)) / 2), 2) + 
                COS(RADIANS(${lat})) * COS(RADIANS(lat)) * 
                POWER(SIN((RADIANS(${lon}) - RADIANS(lon)) / 2), 2))) AS distance
            FROM Restaurants
            WHERE 
                6371 * 2 * ASIN(SQRT(POWER(SIN((RADIANS(${lat}) - RADIANS(lat)) / 2), 2) + 
                COS(RADIANS(${lat})) * COS(RADIANS(lat)) * 
                POWER(SIN((RADIANS(${lon}) - RADIANS(lon)) / 2), 2))) <= 1
                AND venue_type = ${venueType}
                AND (
                    hours->'regular' @> ${hoursJson}::jsonb
                    OR EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(hours->'regular') AS elem
                        WHERE 
                            (elem->>'day')::int = ${currentDay}
                            AND
                            (elem->>'open')::text <= ${formattedTime}
                            AND
                            (elem->>'close')::text >= ${formattedTime}
                    )
                );
        `;

        // console.log(result);
        return result.rows;
    } catch (error: any) {
        throw new Error(`Error fetching venues: ${error.message}`);
    }
}


export async function storeRestaurants(restaurants: Restaurant[], venueType: string): Promise<{ result: string }> {
    try {
        if (restaurants.length === 0) {
            return { result: 'No restaurants to store' };
        }

        // await createRestaurantTableIfNotExists();

        // Begin transaction
        await sql`BEGIN`;

        for (const restaurant of restaurants) {
            const { fsq_id, name, location = {}, description = '', geocodes = {}, attributes = {}, hours = {}, menu = {}, photos = [] } = restaurant;
            const latitude = geocodes?.main?.latitude;
            const longitude = geocodes?.main?.longitude;
            await sql`
                INSERT INTO Restaurants (
                    venue_type, name, lat, lon, description, attributes, hours, menu, photos, location, queried_at
                ) VALUES (
                    ${venueType},
                    ${name},
                    ${latitude},
                    ${longitude},
                    ${description},
                    ${JSON.stringify(attributes)},
                    ${JSON.stringify(hours)},
                    ${JSON.stringify(menu)},
                    ${JSON.stringify(photos)},
                    ${JSON.stringify(location)},
                    NOW()
                )
                ON CONFLICT (lat, lon, name)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    attributes = EXCLUDED.attributes,
                    hours = EXCLUDED.hours,
                    menu = EXCLUDED.menu,
                    photos = EXCLUDED.photos,
                    queried_at = NOW()
            `;
        }

        // Commit transaction
        await sql`COMMIT`;
        console.log("stored");
        return { result: 'Restaurants stored successfully' };
    } catch (error: any) {
        console.log("aqui");
        // Rollback in case of an error
        await sql`ROLLBACK`;
        throw new Error(error.message);
    }
}
