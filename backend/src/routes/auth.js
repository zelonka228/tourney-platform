import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import prisma from "../db.js";
import { asyncHandler, requireFields, HttpError } from "../http.js";
import { signToken } from "../auth.js";
import { validatePassword, validateUsername } from "../password.js";

const router = Router();
const BIO_MAX_LEN = 500;

// Now that the site is publicly reachable, /login and /register are the
// only unauthenticated write paths — worth capping per-IP so a script can't
// brute-force a password or spam-create accounts. Deliberately generous
// (typos/shared-office IPs shouldn't get blocked), not a strict security
// boundary — see docs/05-auth-registration-spec.md for what's still
// intentionally out of scope (no lockout, no CAPTCHA).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато спроб входу. Спробуйте ще раз за кілька хвилин." },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато реєстрацій з цієї адреси. Спробуйте пізніше." },
});

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["username", "password"]);
    const { username, password } = req.body;

    // Registration guarantees case-insensitive uniqueness via usernameLower
    // — login matches the same way so "Admin"/"admin" both work.
    const user = await prisma.user.findUnique({
      where: { usernameLower: String(username).toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Невірний логін або пароль.");
    }

    res.json({
      token: signToken(user),
      user: { id: user.id, username: user.username, role: user.role },
    });
  })
);

// POST /api/auth/register → public self-registration, always role "user".
router.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["username", "password"]);
    const { username, password } = req.body;

    validateUsername(username);
    validatePassword(password, username);

    const user = await prisma.user.create({
      data: {
        username,
        usernameLower: username.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        role: "user",
      },
    });

    res.status(201).json({
      token: signToken(user),
      user: { id: user.id, username: user.username, role: user.role },
    });
  })
);

// GET /api/auth/me → resolve the current token, or null if absent/invalid.
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return res.json({ user: null });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
      },
    });
  })
);

// PUT /api/auth/me → self-service edit, bio/avatar only (login/role are
// admin-managed via /api/admin/users, not self-service).
router.put(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, "Потрібна авторизація.");
    const { bio, avatar } = req.body ?? {};

    if (bio !== undefined && bio !== null && bio.length > BIO_MAX_LEN) {
      throw new HttpError(400, `Біо не може перевищувати ${BIO_MAX_LEN} символів.`);
    }

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: {
        ...(bio !== undefined ? { bio } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      },
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
      },
    });
  })
);

export default router;
