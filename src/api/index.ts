import express from 'express';
import geoip from 'geoip-lite';
import moment from 'moment';
import { Request, Response, NextFunction } from 'express';
import { getCachedOrFetch, VenueType } from '../util/enrich.js';

const app = express();

interface CustomRequest extends Request {
    location?: { latitude: string; longitude: string } | null;
    venueType?: string;
    isoTime?: string;
}

export const locationMiddleware = (req: CustomRequest, res: Response, next: NextFunction): void => {
    let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    console.log(ip)
    if (Array.isArray(ip)) {
        ip = ip.length > 0 ? ip[0] : '';  // Take the first IP if it's an array
    }
    ip = ip.split(',')[0].trim();  // Now we safely call split      
    const geo = geoip.lookup(ip);

    if (geo) {
        const [latitudeRaw, longitudeRaw] = geo.ll;

        const latitude = `${latitudeRaw}`;
        const longitude = `${longitudeRaw}`;

        req.location = { latitude, longitude };
    } else {
        req.location = null;
    }
    next();
};

const getHourFromISOTime = (isoTime: string): number => {
    // Parse the ISO time string with moment
    const time = moment(isoTime);

    // Use the .hour() method to get the hour component and return it
    return time.hour();  // This returns the hour (0-23)
}

app.use(locationMiddleware);

app.get("/test", async (req: Request, res: Response) => {
    res.send("Express on Vercel");
});

app.get("/v1/venues", async (req: CustomRequest, res: Response) => {
    try {
        let { latitude, longitude, venueType, isoTime } = req.query;
        const dateHeader = req.get('Date');
        let hour = null;

        if (dateHeader) {
            // Try to convert the Date header to a JavaScript Date object
            hour = getHourFromISOTime(new Date(dateHeader).toISOString());
            console.log(`Received a request with a Date header at ${hour} for ${req.originalUrl}`);
        }

        if (typeof isoTime === 'string') {
            try {
                hour = getHourFromISOTime(isoTime);
            } catch (error) {
                res.status(400).send({ error: "Invalid ISO time format." });
            }
        } 

        // if not query params, try to derive
        if (!latitude || !longitude) {
            latitude = req.location?.latitude;
            longitude = req.location?.longitude;
        }

        if (hour) {
            venueType = venueType ?? (hour >= 5 && hour < 17 ? VenueType.coffee : VenueType.drinks);
        }

        // if STILL not there, return an error
        if (!latitude || !longitude || !venueType) {
            return res.status(400).json({ error: 'Location information or venue type is missing from the request.' });
        }

        // find venues based on metadata
        const venues = await getCachedOrFetch(Number(latitude), Number(longitude), venueType as VenueType);
        res.json(venues);
    } catch (error) {
        console.error("Error fetching venues:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

export default app;
