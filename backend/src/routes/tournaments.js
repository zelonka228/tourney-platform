// Tournaments API — list/get/create/update/delete + team registration + bracket.
import { Router } from "express";
import prisma from "../db.js";
import { DISCIPLINES } from "../rating.js";
import { buildBracketRows } from "../bracket.js";
import { resolveByes } from "../advance.js";
import { asyncHandler, requireFields, requireEnum, HttpError, parseId } from "../http.js";
import { requireAdmin } from "../auth.js";

const router = Router();

const DISCIPLINE_VALUES = Object.keys(DISCIPLINES); // ["CS2", "Dota 2", "Valorant"]
const BRACKET_TYPES = ["single", "double"];
const MATCH_FORMATS = [1, 3, 5];

// Every response nests the actual Team (name, logo, ...) under each
// TournamentTeam row — the frontend needs names to render the bracket, not
// just raw teamId foreign keys.
const TEAMS_WITH_TEAM = { include: { team: true } };

// GET /api/tournaments → all tournaments with teams
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tournaments = await prisma.tournament.findMany({ include: { teams: TEAMS_WITH_TEAM } });
    res.json(tournaments);
  })
);

// GET /api/tournaments/:id → one with teams + matches or 404
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: TEAMS_WITH_TEAM, matches: true },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    res.json(tournament);
  })
);

// POST /api/tournaments → create; optional teamIds seed TournamentTeam rows AND
// (single elimination only) immediately generate the Match bracket in the same call.
router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, discipline, bracketType, matchFormat, teamIds } = req.body ?? {};

    requireFields(req.body, ["name", "discipline", "bracketType", "matchFormat"]);
    requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    requireEnum("bracketType", bracketType, BRACKET_TYPES);
    requireEnum("matchFormat", Number(matchFormat), MATCH_FORMATS);

    const hasTeams = Array.isArray(teamIds) && teamIds.length > 0;
    if (hasTeams && bracketType === "double") {
      throw new HttpError(400, "Подвійне вибування ще не підтримується.");
    }

    const data = { name, discipline, bracketType, matchFormat: Number(matchFormat) };

    if (hasTeams) {
      data.teams = {
        create: teamIds.map((teamId, i) => ({ teamId: Number(teamId), seed: i + 1 })),
      };
      data.matches = {
        create: buildBracketRows(teamIds.map(Number)),
      };
    }

    const tournament = await prisma.tournament.create({
      data,
      include: { teams: TEAMS_WITH_TEAM, matches: true },
    });

    let result = tournament;
    if (hasTeams) {
      await resolveByes(prisma, tournament.id);
      result = await prisma.tournament.findUnique({
        where: { id: tournament.id },
        include: { teams: TEAMS_WITH_TEAM, matches: true },
      });
    }

    res.status(201).json(result);
  })
);

// POST /api/tournaments/:id/generate-bracket → generate Match rows from teams
// already registered via /register (for when teamIds weren't supplied at creation).
router.post(
  "/:id/generate-bracket",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: { orderBy: { seed: "asc" }, include: { team: true } }, matches: true },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    if (tournament.bracketType === "double") {
      throw new HttpError(400, "Подвійне вибування ще не підтримується.");
    }
    if (tournament.matches.length > 0) {
      throw new HttpError(409, "Сітку для цього турніру вже згенеровано.");
    }
    if (tournament.teams.length < 2) {
      throw new HttpError(400, "Потрібно щонайменше 2 зареєстровані команди.");
    }

    const rows = buildBracketRows(tournament.teams.map((t) => t.teamId));
    await prisma.match.createMany({
      data: rows.map((r) => ({ ...r, tournamentId: id })),
    });
    await resolveByes(prisma, id);

    const updated = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: TEAMS_WITH_TEAM, matches: true },
    });
    res.status(201).json(updated);
  })
);

// PUT /api/tournaments/:id → update scalar fields (name, status, date, matchFormat, ...)
router.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
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
      include: { teams: TEAMS_WITH_TEAM },
    });
    res.json(tournament);
  })
);

// DELETE /api/tournaments/:id → 204 (cascade removes teams/matches)
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Турнір не знайдено.");
    await prisma.tournament.delete({ where: { id } });
    res.status(204).end();
  })
);

// POST /api/tournaments/:id/register → register a team (seed = count + 1)
router.post(
  "/:id/register",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { teamId } = req.body ?? {};

    requireFields(req.body, ["teamId"]);

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { matches: true } } },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    if (tournament.status === "completed") {
      throw new HttpError(409, "Турнір вже завершено, реєстрація закрита.");
    }
    if (tournament._count.matches > 0) {
      throw new HttpError(409, "Сітку вже згенеровано, реєстрація закрита.");
    }

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) throw new HttpError(404, "Команду не знайдено.");

    // Duplicate registration violates @@unique([tournamentId, teamId]) → 409.
    const already = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_teamId: { tournamentId: id, teamId: Number(teamId) } },
    });
    if (already) throw new HttpError(409, "Команда вже зареєстрована в цьому турнірі.");

    // count()+create() as two separate statements let concurrent registrations
    // read the same count and collide on the same seed — wrap in a transaction
    // so SQLite serializes them instead of interleaving.
    await prisma.$transaction(async (tx) => {
      const count = await tx.tournamentTeam.count({ where: { tournamentId: id } });
      await tx.tournamentTeam.create({
        data: { tournamentId: id, teamId: Number(teamId), seed: count + 1 },
      });
    });

    const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId: id } });
    res.status(201).json(teams);
  })
);

export default router;
