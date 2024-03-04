import express from 'express';
import { Request, Response } from 'express';

const app = express();

app.get("/test", (req: Request, res: Response) => res.send("Express on Vercel"));
app.get("/test2", (req: Request, res: Response) => res.send("Express on Vercel2"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

export default app;
