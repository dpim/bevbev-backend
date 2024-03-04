import { sql } from '@vercel/postgres';
import { Request, Response } from 'express';

export async function createRestaurantTable(req: Request, res: Response) {
    try {
        const result = await sql`CREATE TABLE IF NOT EXISTS Restaurants ( Name varchar(255), Owner varchar(255) );`;
        res.status(200).json({ result: 'Table created successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function getStoredRestaurants(req: Request, res: Response) {
    try {
        // Assuming you want to select data from the Restaurants table
        const result = await sql`SELECT * FROM Restaurants;`;
        res.status(200).json({ restaurants: result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
