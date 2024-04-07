import express from 'express';
import { Request, Response } from 'express';
import { findFsqCoffee, findFsqDrinks } from '../util/foursquare.js';

const app = express();

app.get("/test", async (req: Request, res: Response) => {
    res.send("Express on Vercel");
});
app.get("/test2", async (req: Request, res: Response) => {
    const bars = await findFsqCoffee(37.7749, -122.4194);
    res.send(bars);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

export default app;
