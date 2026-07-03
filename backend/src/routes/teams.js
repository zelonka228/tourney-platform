// Teams API — CRUD + team rating.
import { Router } from "express";
import prisma from "../db.js";
import { avgRating, DISCIPLINES } from "../rating.js";
import { asyncHandler, requireFields, requireEnum, HttpError } from "../http.js";

const router = Router();

const DISCIPLINE_VALUES = Object.keys(DISCIPLINES); // ["CS2", "Dota 2", "Valorant"]

// GET /api/teams → all teams with players
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const teams = await prisma.team.findMany({ include: { players: true } });
    res.json(teams);
  })
);

// GET /api/teams/:id/rating → average rating over players
// Defined before "/:id" so the path resolves distinctly.
router.get(
  "/:id/rating",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const team = await prisma.team.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!team) throw new HttpError(404, "Команду не знайдено.");

    const rating = avgRating(
      team.discipline,
      team.players.map((p) => p.rank)
    );
    // avgRating returns { label, unit }. Spec wants a `value` field; derive a
    // numeric value from the label when it is numeric (null for ranked units).
    const value =
      rating.value ?? (Number.isNaN(Number(rating.label)) ? null : Number(rating.label));
    res.json({
      discipline: team.discipline,
      unit: rating.unit,
      label: rating.label,
      value,
    });
  })
);

// GET /api/teams/:id → one team with players or 404
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const team = await prisma.team.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!team) throw new HttpError(404, "Команду не знайдено.");
    res.json(team);
  })
);

// POST /api/teams → create team + nested players
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, discipline, logo, winrate, streak, tournaments, best, players = [] } =
      req.body ?? {};

    requireFields(req.body, ["name", "discipline"]);
    requireEnum("discipline", discipline, DISCIPLINE_VALUES);

    const team = await prisma.team.create({
      data: {
        name,
        discipline,
        logo,
        winrate,
        streak,
        ...(tournaments != null ? { tournaments } : {}),
        best,
        players: {
          create: players.map((p) => ({
            nick: p.nick,
            role: p.role,
            rank: p.rank,
            isSubstitute: p.isSubstitute ?? false,
          })),
        },
      },
      include: { players: true },
    });
    res.status(201).json(team);
  })
);

// PUT /api/teams/:id → update scalar fields; replace roster if players provided
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, discipline, logo, winrate, streak, tournaments, best, players } =
      req.body ?? {};

    if (discipline !== undefined) requireEnum("discipline", discipline, DISCIPLINE_VALUES);

    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Команду не знайдено.");

    const data = {
      ...(name !== undefined ? { name } : {}),
      ...(discipline !== undefined ? { discipline } : {}),
      ...(logo !== undefined ? { logo } : {}),
      ...(winrate !== undefined ? { winrate } : {}),
      ...(streak !== undefined ? { streak } : {}),
      ...(tournaments !== undefined ? { tournaments } : {}),
      ...(best !== undefined ? { best } : {}),
    };

    if (Array.isArray(players)) {
      await prisma.player.deleteMany({ where: { teamId: id } });
      data.players = {
        create: players.map((p) => ({
          nick: p.nick,
          role: p.role,
          rank: p.rank,
          isSubstitute: p.isSubstitute ?? false,
        })),
      };
    }

    const team = await prisma.team.update({
      where: { id },
      data,
      include: { players: true },
    });
    res.json(team);
  })
);

// DELETE /api/teams/:id → 204 (cascade handles children)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Команду не знайдено.");
    await prisma.team.delete({ where: { id } });
    res.status(204).end();
  })
);

export default router;
