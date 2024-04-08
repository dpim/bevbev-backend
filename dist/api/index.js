import express from 'express';
import { getCachedOrFetch } from '../util/enrich.js';
const app = express();
app.get("/test", async (req, res) => {
    res.send("Express on Vercel");
});
app.get("/v1/venues", async (req, res) => {
    try {
        const { latitude, longitude, venue_type } = req.query;
        if (!latitude || !longitude || !venue_type) {
            return res.status(400).json({ error: 'Latitude, longitude, and venue_type are required parameters' });
        }
        const venues = await getCachedOrFetch(Number(latitude), Number(longitude), venue_type);
        res.json(venues);
    }
    catch (error) {
        console.error("Error fetching venues:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
export default app;
