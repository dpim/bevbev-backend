import express from 'express';
import geoip from 'geoip-lite';
import moment from 'moment';
import { Request, Response, NextFunction } from 'express';
import { getCachedOrFetch, VenueType } from '../util/enrich.js';
import { z } from 'zod';
import { upvoteRestaurant, downvoteRestaurant } from '../util/storage.js';

const app = express();

interface CustomRequest extends Request {
    location?: { latitude: string; longitude: string } | null;
    venueType?: string;
    isoTime?: string;
    appId?: string; // Add this line
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

const appIdMiddleware = (req: CustomRequest, res: Response, next: NextFunction): void => {
    const appId = req.headers['x-app-id'];
    if (typeof appId === 'string') {
        req.appId = appId;
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
app.use(appIdMiddleware); // Add this line to use the new middleware

app.get("/test", async (req: Request, res: Response) => {
    res.send("Express on Vercel");
});

const VenueRequestSchema = z.object({
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  venueType: z.nativeEnum(VenueType).optional(),
  isoTime: z.string().optional(),
});

app.get("/v1/venues", async (req: CustomRequest, res: Response) => {
  try {
    const result = VenueRequestSchema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request parameters', details: result.error.issues });
    }

    let { latitude, longitude, venueType, isoTime } = result.data;
    const dateHeader = req.get('Date');
    let hour: number | null = null;

    if (dateHeader) {
      hour = getHourFromISOTime(new Date(dateHeader).toISOString());
      console.log(`Received a request with a Date header at ${hour} for ${req.originalUrl}`);
    }

    if (isoTime) {
      try {
        hour = getHourFromISOTime(isoTime);
      } catch (error) {
        return res.status(400).json({ error: "Invalid ISO time format." });
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

app.post("/v1/venues/:id/upvote", async (req: CustomRequest, res: Response) => {
  try {
    console.log("upvoting");
    const { id } = req.params;
    if (!req.appId) {
      return res.status(400).json({ error: 'App ID is missing' });
    }
    await upvoteRestaurant(Number(id), req.appId);
    res.json({ message: 'Upvote successful' });
  } catch (error) {
    console.error("Error upvoting restaurant:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/v1/venues/:id/downvote", async (req: CustomRequest, res: Response) => {
  try {
    console.log("downvoting");
    const { id } = req.params;
    if (!req.appId) {
      return res.status(400).json({ error: 'App ID is missing' });
    }
    await downvoteRestaurant(Number(id), req.appId);
    res.json({ message: 'Downvote successful' });
  } catch (error) {
    console.error("Error downvoting restaurant:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

export default app;