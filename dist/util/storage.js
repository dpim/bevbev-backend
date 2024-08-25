import { sql } from '@vercel/postgres';
async function clearTable() {
    await sql `
        TRUNCATE TABLE Restaurants RESTART IDENTITY CASCADE;
    `;
}
async function addUniqueConstraint() {
    await sql `
    ALTER TABLE Restaurants ADD CONSTRAINT unique_lat_lon_name UNIQUE (lat, lon, name);
    `;
}
export async function createRestaurantTableIfNotExists() {
    try {
        // Enable PostGIS extension if not already enabled
        await sql `CREATE EXTENSION IF NOT EXISTS postgis;`;
        // Create Restaurants table if not exists
        await sql `
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
                queried_at TIMESTAMP,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0
            );
        `;
        // Add upvotes and downvotes columns if they don't exist
        await sql `
            DO $$ 
            BEGIN 
                ALTER TABLE Restaurants ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
                ALTER TABLE Restaurants ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END $$;
        `;
        // Add unique constraint if it doesn't exist
        await sql `
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'unique_lat_lon_name'
                ) THEN
                    ALTER TABLE Restaurants ADD CONSTRAINT unique_lat_lon_name UNIQUE (lat, lon, name);
                END IF;
            END $$;
        `;
        console.log("Table creation and updates completed successfully");
    }
    catch (error) {
        console.error(`Error in createRestaurantTableIfNotExists: ${error.message}`);
        throw new Error(`Error creating Restaurants table: ${error.message}`);
    }
}
export async function getStoredRestaurants(lat, lon, venueType) {
    // console.log("Entering getStoredRestaurants");
    // await createRestaurantTableIfNotExists();
    // await clearTable();
    // console.log("Table cleared");
    try {
        const currentTime = new Date();
        currentTime.setMinutes(Math.round(currentTime.getMinutes() / 30) * 30);
        const currentDay = currentTime.getDay() + 1;
        const formattedTime = currentTime.toTimeString().slice(0, 5).replace(':', '');
        const result = await sql `
            WITH nearby_restaurants AS (
                SELECT *, 
                    ST_Distance(
                        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
                    ) / 1000 AS distance,
                    COALESCE(upvotes, 0) as upvotes,
                    COALESCE(downvotes, 0) as downvotes
                FROM Restaurants
                WHERE ST_DWithin(
                    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
                    1000
                )
                AND venue_type = ${venueType}
            )
            SELECT * FROM nearby_restaurants
            WHERE EXISTS (
                SELECT 1
                FROM jsonb_array_elements(hours->'regular') AS elem
                WHERE 
                    (elem->>'day')::int = ${currentDay}
                    AND
                    (elem->>'open')::text <= ${formattedTime}
                    AND
                    (elem->>'close')::text >= ${formattedTime}
            )
            ORDER BY distance
            LIMIT 50;
        `;
        return result.rows;
    }
    catch (error) {
        console.error(`Error in getStoredRestaurants: ${error.message}`);
        throw new Error(`Error fetching venues: ${error.message}`);
    }
}
export async function storeRestaurants(restaurants, venueType) {
    try {
        if (restaurants.length === 0) {
            return { result: 'No restaurants to store' };
        }
        await createRestaurantTableIfNotExists();
        // Begin transaction
        await sql `BEGIN`;
        for (const restaurant of restaurants) {
            const { fsq_id, name, location = {}, description = '', geocodes = {}, attributes = {}, hours = {}, menu = {}, photos = [] } = restaurant;
            const latitude = geocodes?.main?.latitude;
            const longitude = geocodes?.main?.longitude;
            await sql `
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
        await sql `COMMIT`;
        console.log("stored");
        return { result: 'Restaurants stored successfully' };
    }
    catch (error) {
        console.log("aqui");
        // Rollback in case of an error
        await sql `ROLLBACK`;
        throw new Error(error.message);
    }
}
export async function upvoteRestaurant(id) {
    try {
        await sql `
      UPDATE Restaurants
      SET upvotes = COALESCE(upvotes, 0) + 1
      WHERE id = ${id};
    `;
        console.log("upvoted");
    }
    catch (error) {
        throw new Error(`Error upvoting restaurant: ${error.message}`);
    }
}
export async function downvoteRestaurant(id) {
    try {
        await sql `
      UPDATE Restaurants
      SET downvotes = COALESCE(downvotes, 0) + 1
      WHERE id = ${id};
    `;
        console.log("downvoted");
    }
    catch (error) {
        throw new Error(`Error downvoting restaurant: ${error.message}`);
    }
}
