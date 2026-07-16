// JWT auth: self-registration allowed, admin/organizer/user roles.
// "admin"/"organizer" can mutate teams/tournaments/matches; "user" is read-only.
import jwt from "jsonwebtoken";
import prisma from "./db.js";
import { HttpError } from "./http.js";

const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "12h";

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function verifyToken(req) {
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
//
// req.user.role always comes from a fresh DB lookup, never straight from
// the JWT payload — an admin promoting someone (or demoting/banning them)
// takes effect on their very next request, not just their next login. The
// JWT still embeds the role it was issued with, but that's now only used
// as the id/username carrier; trusting it for authorization was the actual
// bug here — GET /api/auth/me already re-reads the DB, so the UI shows the
// current role and renders the create-tournament button, while every
// mutating route kept enforcing the STALE role from login time, silently
// rejecting a freshly-promoted organizer with a confusing 403 until they
// happened to log out and back in.
export async function attachUser(req, _res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    req.user = null;
    return next();
  }
  // This middleware runs on every request and isn't wrapped in asyncHandler
  // (it's mounted directly via app.use, before routing) — Express 4 won't
  // catch a rejected promise here on its own, so a DB hiccup would hang the
  // request instead of surfacing as an error. Fail closed to "no user"
  // instead: worst case an authenticated request is treated as anonymous
  // for that one request, which the route's own 401/403 already handles.
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    req.user = user ? { sub: user.id, username: user.username, role: user.role } : null;
  } catch {
    req.user = null;
  }
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
