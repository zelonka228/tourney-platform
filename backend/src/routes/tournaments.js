// Tournaments API — list/get/create/update/delete + team registration.
import { Router } from "express";
import prisma from "../db.js";
import { DISCIPLINES } from "../rating.js";
import { asyncHandler, requireFields, requireEnum, HttpError } from "../http.js";

const router = Router();

const DISCIPLINE_VALUES = Object.keys(DISCIPLINES); // ["CS2", "Dota 2", "Valorant"]
const BRACKET_TYPES = ["single", "double"];
const MATCH_FORMATS = [1, 3, 5];

// GET /api/tournaments → all tournaments with teams
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tournaments = await prisma.tournament.findMany({ include: { teams: true } });
    res.json(tournaments);
  })
);

// GET /api/tournaments/:id → one with teams + matches or 404
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: true, matches: true },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    res.json(tournament);
  })
);

// POST /api/tournaments → create; optional teamIds create seeded TournamentTeam rows
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, discipline, bracketType, matchFormat, teamIds } = req.body ?? {};

    requireFields(req.body, ["name", "discipline", "bracketType", "matchFormat"]);
    requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    requireEnum("bracketType", bracketType, BRACKET_TYPES);
    requireEnum("matchFormat", Number(matchFormat), MATCH_FORMATS);

    const data = { name, discipline, bracketType, matchFormat: Number(matchFormat) };

    if (Array.isArray(teamIds) && teamIds.length > 0) {
      data.teams = {
        create: teamIds.map((teamId, i) => ({ teamId: Number(teamId), seed: i + 1 })),
      };
    }

    const tournament = await prisma.tournament.create({ data, include: { teams: true } });
    res.status(201).json(tournament);
  })
);

// PUT /api/tournaments/:id → update scalar fields (name, status, date, matchFormat, ...)
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, discipline, bracketType, matchFormat, status, date } = req.body ?? {};

    if (discipline !== undefined) requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    if (bracketType !== undefined) requireEnum("bracketType", bracketType, BRACKET_TYPES);
    if (matchFormat !== undefined) requireEnum("matchFormat", Number(matchFormat), MATCH_FORMATS);

    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Турнір не знайдено.");

    const data = {
      ...(name !== undefined ? { name } : {}),
      ...(discipline !== undefined ? { discipline } : {}),
      ...(bracketType !== undefined ? { bracketType } : {}),
      ...(matchFormat !== undefined ? { matchFormat: Number(matchFormat) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(date !== undefined ? { date } : {}),
    };

    const tournament = await prisma.tournament.update({
      where: { id },
      data,
      include: { teams: true },
    });
    res.json(tournament);
  })
);

// DELETE /api/tournaments/:id → 204 (cascade removes teams/matches)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Турнір не знайдено.");
    await prisma.tournament.delete({ where: { id } });
    res.status(204).end();
  })
);

// POST /api/tournaments/:id/register → register a team (seed = count + 1)
router.post(
  "/:id/register",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { teamId } = req.body ?? {};

    requireFields(req.body, ["teamId"]);

    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) throw new HttpError(404, "Команду не знайдено.");

    // Duplicate registration violates @@unique([tournamentId, teamId]) → 409.
    const already = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_teamId: { tournamentId: id, teamId: Number(teamId) } },
    });
    if (already) throw new HttpError(409, "Команда вже зареєстрована в цьому турнірі.");

    const count = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
    await prisma.tournamentTeam.create({
      data: { tournamentId: id, teamId: Number(teamId), seed: count + 1 },
    });

    const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId: id } });
    res.status(201).json(teams);
  })
);

export default router;
