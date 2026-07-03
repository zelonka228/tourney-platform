// Backend entry (Week 2) — Express REST API over Prisma + Socket.io live layer.
// Stack: Node.js + Express (ESM) + Socket.io. DB: Prisma (SQLite).

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import teamsRouter from "./routes/teams.js";
import tournamentsRouter from "./routes/tournaments.js";
import { notFound, errorHandler } from "./http.js";

const app = express();
app.use(cors());
app.use(express.json());

// --- REST API ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/teams", teamsRouter);
app.use("/api/tournaments", tournamentsRouter);

// Unmatched routes → 404, then the central error handler (must be last).
app.use(notFound);
app.use(errorHandler);

// --- Real-time: live match result updates ---
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);
  socket.on("match:update", (payload) => {
    io.emit("match:updated", payload);
  });
  socket.on("disconnect", () => console.log("client disconnected:", socket.id));
});

const PORT = Number(process.env.PORT ?? 4000);
httpServer.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`));
