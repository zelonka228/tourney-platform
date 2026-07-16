// Backend entry (Week 2) — Express REST API over Prisma + Socket.io live layer.
// Stack: Node.js + Express (ESM) + Socket.io. DB: Prisma (SQLite).

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import teamsRouter from "./routes/teams.js";
import tournamentsRouter from "./routes/tournaments.js";
import matchesRouter from "./routes/matches.js";
import playersRouter from "./routes/players.js";
import authRouter from "./routes/auth.js";
import adminUsersRouter from "./routes/adminUsers.js";
import { attachUser } from "./auth.js";
import { notFound, errorHandler } from "./http.js";

const app = express();
// Render (and most PaaS hosts) sit behind a reverse proxy — without this,
// express-rate-limit can't tell real client IPs apart (X-Forwarded-For is
// present but untrusted) and either mis-attributes every request to the
// proxy's IP or refuses to start. Harmless locally (no proxy in front).
app.set("trust proxy", 1);
app.use(cors());
// Default express.json() limit is 100kb — too small for team payloads that
// include a base64 logo (frontend allows data URLs up to ~300kb after JPEG
// compression), which silently failed every save with an unhelpful 500.
app.use(express.json({ limit: "1mb" }));
app.use(attachUser);

// --- REST API ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/tournaments", tournamentsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/players", playersRouter);

// Unmatched routes → 404, then the central error handler (must be last).
app.use(notFound);
app.use(errorHandler);

// --- Real-time: live match result updates ---
// Clients join a room per tournament so score updates only reach viewers of
// that tournament, not every connected client. Routes emit via req.app.get("io").
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
app.set("io", io);

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);
  socket.on("tournament:join", (tournamentId) => {
    socket.join(`tournament:${tournamentId}`);
  });
  socket.on("tournament:leave", (tournamentId) => {
    socket.leave(`tournament:${tournamentId}`);
  });
  socket.on("disconnect", () => console.log("client disconnected:", socket.id));
});

const PORT = Number(process.env.PORT ?? 4000);
httpServer.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`));
