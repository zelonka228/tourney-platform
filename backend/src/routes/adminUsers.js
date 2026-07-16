// Account management — admin-only. "organizer" has full rights over
// teams/tournaments/matches (see requireContentManager) but never reaches
// this router: every route here is gated by requireAdmin specifically.
import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../db.js";
import { asyncHandler, requireFields, requireEnum, HttpError, parseId } from "../http.js";
import { requireAdmin } from "../auth.js";
import { validatePassword, validateUsername } from "../password.js";

const router = Router();
router.use(requireAdmin);

const ROLE_VALUES = ["admin", "organizer", "user"];
const BIO_MAX_LEN = 500;

const PUBLIC_FIELDS = {
  id: true,
  username: true,
  role: true,
  bio: true,
  avatar: true,
  createdAt: true,
};

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: PUBLIC_FIELDS,
      orderBy: { id: "asc" },
    });
    res.json(users);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { username, role, bio, avatar } = req.body ?? {};

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Користувача не знайдено.");

    if (role !== undefined) requireEnum("role", role, ROLE_VALUES);
    if (username !== undefined) validateUsername(username);
    if (bio !== undefined && bio !== null && bio.length > BIO_MAX_LEN) {
      throw new HttpError(400, `Біо не може перевищувати ${BIO_MAX_LEN} символів.`);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(username !== undefined ? { username, usernameLower: username.toLowerCase() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      },
      select: PUBLIC_FIELDS,
    });
    res.json(user);
  })
);

router.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    requireFields(req.body, ["password"]);
    const { password } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "Користувача не знайдено.");
    validatePassword(password, target.username);

    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    res.status(204).end();
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, "Користувача не знайдено.");

    if (id === req.user.sub) {
      throw new HttpError(409, "Не можна видалити власний акаунт через цю панель.");
    }
    if (target.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        throw new HttpError(409, "Неможливо видалити останнього адміністратора.");
      }
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  })
);

export default router;
