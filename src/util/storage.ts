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
    query?: string;
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
        // Enable PostGIS extension if not already enabled
        await sql`CREATE EXTENSION IF NOT EXISTS postgis;`;

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
                queried_at TIMESTAMP,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                query VARCHAR(255)
            );
        `;

        // Add upvotes and downvotes columns if they don't exist
        await sql`
            DO $$ 
            BEGIN 
                ALTER TABLE Restaurants ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
                ALTER TABLE Restaurants ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END $$;
        `;

        // Add unique constraint if it doesn't exist
        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'unique_lat_lon_name'
                ) THEN
                    ALTER TABLE Restaurants ADD CONSTRAINT unique_lat_lon_name UNIQUE (lat, lon, name);
                END IF;
            END $$;
        `;

        // Create UserVotes table
        await createUserVotesTableIfNotExists();

        console.log("Table creation and updates completed successfully");

    } catch (error: any) {
        console.error(`Error in createRestaurantTableIfNotExists: ${error.message}`);
        throw new Error(`Error creating tables: ${error.message}`);
    }
}

export async function getStoredRestaurants(lat: number, lon: number, venueType: string, query: string | null = null): Promise<any[]> {
    // console.log("Entering getStoredRestaurants");
    // await createRestaurantTableIfNotExists();
    // await clearTable();
    // console.log("Table cleared");
    try {
        const currentTime = new Date();
        currentTime.setMinutes(Math.round(currentTime.getMinutes() / 30) * 30);
        const currentDay = currentTime.getDay() + 1;
        const formattedTime = currentTime.toTimeString().slice(0, 5).replace(':', '');

        const result = await sql`
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
                AND (
                    query IS NULL 
                    OR query = ${query}
                    OR (${query} IS NULL AND query IS NULL)
                )
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
    } catch (error: any) {
        console.error(`Error in getStoredRestaurants: ${error.message}`);
        throw new Error(`Error fetching venues: ${error.message}`);
    }
}


export async function storeRestaurants(restaurants: Restaurant[], venueType: string, query?: string): Promise<{ result: string, storedRestaurants: any[] }> {
    try {
        if (restaurants.length === 0) {
            return { result: 'No restaurants to store', storedRestaurants: [] };
        }

        await createRestaurantTableIfNotExists();

        // Begin transaction
        await sql`BEGIN`;

        const storedRestaurants = [];

        for (const restaurant of restaurants) {
            const { fsq_id, name, location = {}, description = '', geocodes = {}, attributes = {}, hours = {}, menu = {}, photos = [] } = restaurant;
            const latitude = geocodes?.main?.latitude;
            const longitude = geocodes?.main?.longitude;
            const result = await sql`
                INSERT INTO Restaurants (
                    venue_type, name, lat, lon, description, attributes, hours, menu, photos, location, queried_at, query
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
                    NOW(),
                    ${query}
                )
                ON CONFLICT (lat, lon, name)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    attributes = EXCLUDED.attributes,
                    hours = EXCLUDED.hours,
                    menu = EXCLUDED.menu,
                    photos = EXCLUDED.photos,
                    queried_at = NOW(),
                    query = EXCLUDED.query
                RETURNING *;
            `;
            storedRestaurants.push(result.rows[0]);
        }

        // Commit transaction
        await sql`COMMIT`;
        console.log("stored");
        return { result: 'Restaurants stored successfully', storedRestaurants };
    } catch (error: any) {
        console.log("aqui");
        // Rollback in case of an error
        await sql`ROLLBACK`;
        throw new Error(error.message);
    }
}

export async function upvoteRestaurant(id: number, userUuid: string): Promise<void> {
    try {
        await sql`
      WITH vote_update AS (
        INSERT INTO UserVotes (user_uuid, restaurant_id, vote_type)
        VALUES (${userUuid}::uuid, ${id}, 'upvote')
        ON CONFLICT (user_uuid, restaurant_id)
        DO UPDATE SET vote_type = 'upvote'
        WHERE UserVotes.vote_type != 'upvote'
        RETURNING (CASE WHEN xmax::text::int > 0 THEN 1 ELSE 0 END) AS updated,
                  (CASE WHEN UserVotes.vote_type = 'downvote' THEN 1 ELSE 0 END) AS was_downvote
      )
      UPDATE Restaurants
      SET upvotes = upvotes + (SELECT updated FROM vote_update),
          downvotes = downvotes - (SELECT was_downvote FROM vote_update)
      WHERE id = ${id};
    `;
        console.log("upvote processed");
    } catch (error: any) {
        throw new Error(`Error processing upvote: ${error.message}`);
    }
}

export async function downvoteRestaurant(id: number, userUuid: string): Promise<void> {
    try {
        await sql`
      WITH vote_update AS (
        INSERT INTO UserVotes (user_uuid, restaurant_id, vote_type)
        VALUES (${userUuid}::uuid, ${id}, 'downvote')
        ON CONFLICT (user_uuid, restaurant_id)
        DO UPDATE SET vote_type = 'downvote'
        WHERE UserVotes.vote_type != 'downvote'
        RETURNING (CASE WHEN xmax::text::int > 0 THEN 1 ELSE 0 END) AS updated,
                  (CASE WHEN UserVotes.vote_type = 'upvote' THEN 1 ELSE 0 END) AS was_upvote
      )
      UPDATE Restaurants
      SET downvotes = downvotes + (SELECT updated FROM vote_update),
          upvotes = upvotes - (SELECT was_upvote FROM vote_update)
      WHERE id = ${id};
    `;
        console.log("downvote processed");
    } catch (error: any) {
        throw new Error(`Error processing downvote: ${error.message}`);
    }
}

export async function createUserVotesTableIfNotExists(): Promise<void> {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS UserVotes (
                id SERIAL PRIMARY KEY,
                user_uuid UUID NOT NULL,
                restaurant_id INTEGER NOT NULL,
                vote_type VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_restaurant
                    FOREIGN KEY(restaurant_id) 
                    REFERENCES Restaurants(id)
                    ON DELETE CASCADE,
                CONSTRAINT unique_user_restaurant UNIQUE (user_uuid, restaurant_id)
            );
        `;
        console.log("UserVotes table creation completed successfully");
    } catch (error: any) {
        console.error(`Error in createUserVotesTableIfNotExists: ${error.message}`);
        throw new Error(`Error creating UserVotes table: ${error.message}`);
    }
}