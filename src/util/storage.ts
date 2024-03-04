import { sql } from '@vercel/postgres';

export async function createRestaurantTable(request: Request) {
    try {
        const result =
            await sql`CREATE TABLE Restaurants ( Name varchar(255), Owner varchar(255) );`;
        return Response.json({ result }, { status: 200 });
    } catch (error) {
        return Response.json({ error }, { status: 500 });
    }
}

// tbd
export async function getStoredRestaurants(request: Request) {
    try {
        const result =
            await sql`CREATE TABLE Restaurants ( Name varchar(255), Owner varchar(255) );`;
        return Response.json({ result }, { status: 200 });
    } catch (error) {
        return Response.json({ error }, { status: 500 });
    }
}