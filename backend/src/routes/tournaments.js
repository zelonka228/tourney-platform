// Tournaments API — list/get/create/update/delete + team registration + bracket.
import { Router } from "express";
import prisma from "../db.js";
import { DISCIPLINES } from "../rating.js";
import { buildBracketRows, buildLosersBracketRows, buildFinalRows, isPowerOfTwo } from "../bracket.js";
import { resolveByes } from "../advance.js";
import { asyncHandler, requireFields, requireEnum, HttpError, parseId } from "../http.js";
import { requireContentManager } from "../auth.js";

const router = Router();

const DISCIPLINE_VALUES = Object.keys(DISCIPLINES); // ["CS2", "Dota 2", "Valorant"]
const BRACKET_TYPES = ["single", "double"];
const MATCH_FORMATS = [1, 3, 5];
// The only two values the app's own logic ever sets: "draft" is the
// default, "completed" is set automatically when the final match is won
// (and reverted back to "draft" if that result gets reset — see
// matches.js). There's no separate "active"/"in progress" state; a
// tournament with a generated bracket and unplayed matches is still
// "draft". Nothing before this fix stopped PUT /:id from writing an
// arbitrary string here.
const STATUS_VALUES = ["draft", "completed"];
const NAME_MAX_LEN = 60;

function checkNameLength(name) {
  if (typeof name === "string" && name.length > NAME_MAX_LEN) {
    throw new HttpError(400, `Назва не може перевищувати ${NAME_MAX_LEN} символів.`);
  }
}

// Double elimination (v1) only supports power-of-two team counts of at
// least 4 — see docs/03-double-elimination-spec.md for why (byes in the
// losers bracket are a substantially harder problem, deliberately out of
// scope for now). 2 teams is excluded too: with no one else to fill a
// losers bracket, the "losers bracket" degenerates to nothing and gains
// nothing over just playing single elimination.
function checkDoubleElimSupported(bracketType, teamCount) {
  if (bracketType === "double" && (teamCount < 4 || !isPowerOfTwo(teamCount))) {
    throw new HttpError(
      400,
      "Подвійне вибування наразі підтримує лише кількість команд, що є степенем двійки, від 4 (4, 8, 16, 32)."
    );
  }
}

function buildAllRows(bracketType, teamIds) {
  const rows = buildBracketRows(teamIds);
  if (bracketType === "double") {
    rows.push(...buildLosersBracketRows(teamIds.length), ...buildFinalRows());
  }
  return rows;
}

// Every response nests the actual Team (name, logo, ...) under each
// TournamentTeam row — the frontend needs names to render the bracket, not
// just raw teamId foreign keys.
const TEAMS_WITH_TEAM = { include: { team: true } };

// Two channels, same underlying "something about tournaments changed"
// event: a global broadcast for list-level pages (Landing stats, the
// tournament picker) that don't care which tournament, and a room-scoped
// one for whoever's currently looking at that specific tournament's page
// (mirrors the existing match:updated room in matches.js). Both are plain
// "go refetch" signals, not payloads to merge — simpler and always
// consistent with whatever a GET would return right now.
function notifyTournamentsChanged(req, tournamentId, extra = {}) {
  const io = req.app.get("io");
  io.emit("tournaments:changed");
  if (tournamentId != null) {
    io.to(`tournament:${tournamentId}`).emit("tournament:updated", { tournamentId, ...extra });
  }
}

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

// POST /api/tournaments → create; optional teamIds seed TournamentTeam rows.
// By default (single elimination only) this also immediately generates the
// Match bracket in the same call — pass `generateBracket: false` to register
// the teams but leave the bracket ungenerated, e.g. for manual seeding: the
// admin reorders teams on the tournament page (PUT .../teams/reorder) and
// generates the bracket later via POST .../generate-bracket once satisfied.
router.post(
  "/",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const { name, discipline, bracketType, matchFormat, teamIds, generateBracket } = req.body ?? {};

    requireFields(req.body, ["name", "discipline", "bracketType", "matchFormat"]);
    requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    requireEnum("bracketType", bracketType, BRACKET_TYPES);
    requireEnum("matchFormat", Number(matchFormat), MATCH_FORMATS);
    checkNameLength(name);

    const hasTeams = Array.isArray(teamIds) && teamIds.length > 0;
    if (hasTeams) checkDoubleElimSupported(bracketType, teamIds.length);
    const shouldGenerate = hasTeams && generateBracket !== false;

    const data = { name, discipline, bracketType, matchFormat: Number(matchFormat) };

    if (hasTeams) {
      data.teams = {
        create: teamIds.map((teamId, i) => ({ teamId: Number(teamId), seed: i + 1 })),
      };
    }
    if (shouldGenerate) {
      data.matches = {
        create: buildAllRows(bracketType, teamIds.map(Number)),
      };
    }

    const tournament = await prisma.tournament.create({
      data,
      include: { teams: TEAMS_WITH_TEAM, matches: true },
    });

    let result = tournament;
    if (shouldGenerate) {
      await resolveByes(prisma, tournament.id);
      result = await prisma.tournament.findUnique({
        where: { id: tournament.id },
        include: { teams: TEAMS_WITH_TEAM, matches: true },
      });
    }

    notifyTournamentsChanged(req, result.id);
    res.status(201).json(result);
  })
);

// POST /api/tournaments/:id/generate-bracket → generate Match rows from teams
// already registered via /register (for when teamIds weren't supplied at creation).
router.post(
  "/:id/generate-bracket",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: { orderBy: { seed: "asc" }, include: { team: true } }, matches: true },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    if (tournament.matches.length > 0) {
      throw new HttpError(409, "Сітку для цього турніру вже згенеровано.");
    }
    if (tournament.teams.length < 2) {
      throw new HttpError(400, "Потрібно щонайменше 2 зареєстровані команди.");
    }
    checkDoubleElimSupported(tournament.bracketType, tournament.teams.length);

    const rows = buildAllRows(
      tournament.bracketType,
      tournament.teams.map((t) => t.teamId)
    );
    await prisma.match.createMany({
      data: rows.map((r) => ({ ...r, tournamentId: id })),
    });
    await resolveByes(prisma, id);

    const updated = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: TEAMS_WITH_TEAM, matches: true },
    });
    notifyTournamentsChanged(req, id);
    res.status(201).json(updated);
  })
);

// PUT /api/tournaments/:id/teams/reorder → reassign seed = index+1 from a
// full ordered list of the tournament's already-registered teamIds. Manual
// seeding: the admin rearranges the "Учасники" list before generating the
// bracket. Blocked once the bracket exists — seed no longer affects
// anything at that point, and silently accepting it would be misleading.
router.put(
  "/:id/teams/reorder",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { teamIds } = req.body ?? {};
    requireFields(req.body, ["teamIds"]);
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      throw new HttpError(400, "teamIds має бути непорожнім масивом.");
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: true, _count: { select: { matches: true } } },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    if (tournament._count.matches > 0) {
      throw new HttpError(409, "Сітку вже згенеровано, порядок команд більше не можна змінити.");
    }

    const current = new Set(tournament.teams.map((t) => t.teamId));
    const proposed = teamIds.map(Number);
    const sameSet =
      proposed.length === current.size && proposed.every((tid) => current.has(tid)) && new Set(proposed).size === proposed.length;
    if (!sameSet) {
      throw new HttpError(400, "teamIds має містити рівно ті команди, що вже зареєстровані в турнірі, без повторів.");
    }

    await prisma.$transaction(
      proposed.map((teamId, i) =>
        prisma.tournamentTeam.update({
          where: { tournamentId_teamId: { tournamentId: id, teamId } },
          data: { seed: i + 1 },
        })
      )
    );

    const updated = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: TEAMS_WITH_TEAM, matches: true },
    });
    notifyTournamentsChanged(req, id);
    res.json(updated);
  })
);

// PUT /api/tournaments/:id → update scalar fields (name, status, date, matchFormat, ...)
router.put(
  "/:id",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { name, discipline, bracketType, matchFormat, status, date } = req.body ?? {};

    if (discipline !== undefined) requireEnum("discipline", discipline, DISCIPLINE_VALUES);
    if (bracketType !== undefined) requireEnum("bracketType", bracketType, BRACKET_TYPES);
    if (matchFormat !== undefined) requireEnum("matchFormat", Number(matchFormat), MATCH_FORMATS);
    if (status !== undefined) requireEnum("status", status, STATUS_VALUES);
    if (name !== undefined) {
      if (name.trim() === "") throw new HttpError(400, "Назва не може бути порожньою.");
      checkNameLength(name);
    }

    const existing = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { matches: true } } },
    });
    if (!existing) throw new HttpError(404, "Турнір не знайдено.");

    // bracketType/matchFormat drive how the Match rows were generated (bracket
    // shape, and which scorelines isValidScore accepts) — changing either
    // once matches exist would desync already-generated/played matches from
    // the tournament's own settings, same class of problem the register/
    // reorder guards above already prevent for the team list.
    if (existing._count.matches > 0) {
      if (bracketType !== undefined && bracketType !== existing.bracketType) {
        throw new HttpError(409, "Сітку вже згенеровано, тип сітки більше не можна змінити.");
      }
      if (matchFormat !== undefined && Number(matchFormat) !== existing.matchFormat) {
        throw new HttpError(409, "Сітку вже згенеровано, формат матчів більше не можна змінити.");
      }
    }

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
    notifyTournamentsChanged(req, id);
    res.json(tournament);
  })
);

// DELETE /api/tournaments/:id → 204 (cascade removes teams/matches)
router.delete(
  "/:id",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Турнір не знайдено.");
    await prisma.tournament.delete({ where: { id } });
    notifyTournamentsChanged(req, id, { deleted: true });
    res.status(204).end();
  })
);

// POST /api/tournaments/:id/register → register a team (seed = count + 1)
router.post(
  "/:id/register",
  requireContentManager,
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
    notifyTournamentsChanged(req, id);
    res.status(201).json(teams);
  })
);

// DELETE /api/tournaments/:id/teams/:teamId → unregister a team before the
// bracket exists (e.g. wrong team picked during manual seeding). Blocked
// once matches are generated — removing a team after that would leave a
// Match pointing at a team no longer in the tournament. Re-sequences the
// remaining teams' seeds to stay contiguous (1..n), same as reorder.
router.delete(
  "/:id/teams/:teamId",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const teamId = parseId(req.params.teamId);

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: { orderBy: { seed: "asc" } }, _count: { select: { matches: true } } },
    });
    if (!tournament) throw new HttpError(404, "Турнір не знайдено.");
    if (tournament._count.matches > 0) {
      throw new HttpError(409, "Сітку вже згенеровано, склад учасників більше не можна змінити.");
    }
    const entry = tournament.teams.find((t) => t.teamId === teamId);
    if (!entry) throw new HttpError(404, "Команда не зареєстрована в цьому турнірі.");

    const remaining = tournament.teams.filter((t) => t.teamId !== teamId);
    await prisma.$transaction([
      prisma.tournamentTeam.delete({ where: { tournamentId_teamId: { tournamentId: id, teamId } } }),
      ...remaining.map((t, i) =>
        prisma.tournamentTeam.update({ where: { id: t.id }, data: { seed: i + 1 } })
      ),
    ]);

    const updated = await prisma.tournament.findUnique({ where: { id }, include: { teams: TEAMS_WITH_TEAM } });
    notifyTournamentsChanged(req, id);
    res.json(updated);
  })
);

export default router;
