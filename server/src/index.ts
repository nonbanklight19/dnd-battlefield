import express from "express";
import { createServer } from "http";

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.get("/health", (_req, res) => res.json({ status: "ok" }));

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
