// Teams API — CRUD + team rating.
import { Router } from "express";
import prisma from "../db.js";
import { avgRating, DISCIPLINES } from "../rating.js";
import { asyncHandler, requireFields, requireEnum, HttpError, parseId } from "../http.js";
import { requireAdmin } from "../auth.js";

const router = Router();

const DISCIPLINE_VALUES = Object.keys(DISCIPLINES); // ["CS2", "Dota 2", "Valorant"]
const NAME_MAX_LEN = 60;
const NICK_MAX_LEN = 40;

function checkNameLength(name) {
  if (typeof name === "string" && name.length > NAME_MAX_LEN) {
    throw new HttpError(400, `Назва команди не може перевищувати ${NAME_MAX_LEN} символів.`);
  }
}

// Player.nick/role/rank are non-null String columns — validate shape before
// handing the array to Prisma's nested create, otherwise a blank/wrong-type
// player (or a non-array `players`) throws a PrismaClientValidationError or
// bare TypeError that errorHandler doesn't map, surfacing as a 500.
function validatePlayers(players) {
  if (!Array.isArray(players)) {
    throw new HttpError(400, "Поле \"players\" має бути масивом.");
  }
  players.forEach((p, i) => {
    const missing = ["nick", "role", "rank"].filter((f) => {
      const v = p?.[f];
      return v === undefined || v === null || String(v).trim() === "";
    });
    if (missing.length > 0) {
      throw new HttpError(
        400,
        `Гравець #${i + 1}: відсутні обов'язкові поля: ${missing.join(", ")}.`
      );
    }
    const wrongType = ["nick", "role", "rank"].filter((f) => typeof p[f] !== "string");
    if (wrongType.length > 0) {
      throw new HttpError(
        400,
        `Гравець #${i + 1}: поля ${wrongType.join(", ")} мають бути рядком.`
      );
    }
    if (p.nick.length > NICK_MAX_LEN) {
      throw new HttpError(400, `Гравець #${i + 1}: нік не може перевищувати ${NICK_MAX_LEN} символів.`);
    }
  });
}

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
    const id = parseId(req.params.id);
    const team = await prisma.team.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!team) throw new HttpError(404, "Команду не знайдено.");

    // Substitutes shouldn't pull the team's rating up/down — average the
    // starting lineup only, consistent with the frontend's calculation.
    const rating = avgRating(
      team.discipline,
      team.players.filter((p) => !p.isSubstitute).map((p) => p.rank)
    );
    res.json({
      discipline: team.discipline,
      unit: rating.unit,
      label: rating.label,
      value: rating.value,
    });
  })
);

// GET /api/teams/:id → one team with players or 404
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
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
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, discipline, logo, winrate, streak, tournaments, best, players = [] } =
      req.body ?? {};

    requireFields(req.body, ["name", "discipline"]);
    requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    checkNameLength(name);
    validatePlayers(players);

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
            externalRef: p.externalRef || null,
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
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { name, discipline, logo, winrate, streak, tournaments, best, players } =
      req.body ?? {};

    if (discipline !== undefined) requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    if (name !== undefined) checkNameLength(name);

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
      validatePlayers(players);
      await prisma.player.deleteMany({ where: { teamId: id } });
      data.players = {
        create: players.map((p) => ({
          nick: p.nick,
          role: p.role,
          rank: p.rank,
          isSubstitute: p.isSubstitute ?? false,
          externalRef: p.externalRef || null,
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

// DELETE /api/teams/:id → 204 (cascade handles TournamentTeam/Player/RatingHistory)
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Команду не знайдено.");

    // Match.teamAId/teamBId are plain columns with no FK relation (a bye slot
    // is legitimately null), so cascading delete can't clean them up — a team
    // that already played a match would leave that Match pointing at a
    // vanished team, permanently unrenderable in the bracket.
    const playedMatch = await prisma.match.findFirst({
      where: { OR: [{ teamAId: id }, { teamBId: id }] },
    });
    if (playedMatch) {
      throw new HttpError(
        409,
        "Неможливо видалити команду: вона бере участь у матчах турніру."
      );
    }

    await prisma.team.delete({ where: { id } });
    res.status(204).end();
  })
);

export default router;
