// JWT auth: two fixed seeded accounts (see prisma/seed.js), no self-registration.
// "admin" can mutate teams/tournaments/matches; "user" is read-only.
import jwt from "jsonwebtoken";
import { HttpError } from "./http.js";

const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "12h";

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function verify(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), SECRET);
  } catch {
    return null;
  }
}

// Attaches req.user if a valid token is present; never rejects the request
// (routes decide for themselves whether auth is required).
export function attachUser(req, _res, next) {
  req.user = verify(req);
  next();
}

export function requireAdmin(req, _res, next) {
  if (!SECRET) throw new HttpError(503, "JWT_SECRET не налаштовано на сервері.");
  if (!req.user) throw new HttpError(401, "Потрібна авторизація.");
  if (req.user.role !== "admin") throw new HttpError(403, "Потрібні права адміністратора.");
  next();
}

// "admin" and "organizer" share the same rights over teams/tournaments/
// matches — only account management (requireAdmin routes) and a team's
// rarityOverride field are admin-only beyond this.
export function requireContentManager(req, _res, next) {
  if (!SECRET) throw new HttpError(503, "JWT_SECRET не налаштовано на сервері.");
  if (!req.user) throw new HttpError(401, "Потрібна авторизація.");
  if (req.user.role !== "admin" && req.user.role !== "organizer") {
    throw new HttpError(403, "Потрібні права організатора або адміністратора.");
  }
  next();
}
