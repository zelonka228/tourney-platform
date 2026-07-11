import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../db.js";
import { asyncHandler, requireFields, HttpError } from "../http.js";
import { signToken } from "../auth.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["username", "password"]);
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Невірний логін або пароль.");
    }

    res.json({
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
    res.json({ user: { id: req.user.sub, username: req.user.username, role: req.user.role } });
  })
);

export default router;
