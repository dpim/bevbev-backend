import express from 'express';
import { findFsqCoffee } from '../util/foursquare.js';
const app = express();
app.get("/test", async (req, res) => {
    res.send("Express on Vercel");
});
app.get("/test2", async (req, res) => {
    const bars = await findFsqCoffee(37.7749, -122.4194);
    res.send(bars);
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
export default app;
