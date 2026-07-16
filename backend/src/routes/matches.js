// Matches API — score submission, winner advancement, live updates.
import { Router } from "express";
import prisma from "../db.js";
import { isValidScore } from "../bracket.js";
import { advanceWinner, advanceLoser, locateWinnerTarget, locateLoserTarget } from "../advance.js";
import { avgRating } from "../rating.js";
import { asyncHandler, requireFields, HttpError, parseId } from "../http.js";
import { requireContentManager } from "../auth.js";

const router = Router();

// PUT /api/matches/:id/score → submit a match result.
// Validates the score against the tournament's matchFormat, marks the match
// done, pushes the winner into the next round's match slot, and snapshots
// both teams' current rating into RatingHistory. If there is no next round
// (this was the final), also marks the tournament completed and updates the
// champion's stats.
router.put(
  "/:id/score",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { scoreA, scoreB } = req.body ?? {};
    requireFields(req.body, ["scoreA", "scoreB"]);

    const match = await prisma.match.findUnique({ where: { id }, include: { tournament: true } });
    if (!match) throw new HttpError(404, "Матч не знайдено.");

    if (match.teamAId == null || match.teamBId == null) {
      throw new HttpError(400, "Суперники ще не визначені для цього матчу.");
    }
    if (match.status === "done") {
      throw new HttpError(409, "Матч уже завершено, редагування рахунку недоступне.");
    }

    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!isValidScore(match.tournament.matchFormat, a, b)) {
      throw new HttpError(
        400,
        `Невалідний рахунок для формату BO${match.tournament.matchFormat}.`
      );
    }

    const winnerId = a > b ? match.teamAId : match.teamBId;

    // Read-then-write on `status` above is not atomic — two concurrent
    // requests can both pass the "already done" check before either commits.
    // updateMany with the same guard folded into the WHERE makes the
    // check-and-set a single statement, so only one concurrent request can
    // ever flip a given match to "done" (the loser gets count:0 → 409),
    // instead of both proceeding to double-advance the winner and
    // double-increment the champion's stats below.
    const { count } = await prisma.match.updateMany({
      where: { id, status: { not: "done" } },
      data: { scoreA: a, scoreB: b, status: "done" },
    });
    if (count === 0) {
      throw new HttpError(409, "Матч уже завершено, редагування рахунку недоступне.");
    }
    const updated = await prisma.match.findUnique({ where: { id } });

    // Snapshot both teams' current rating into history for every played match
    // (byes don't go through this endpoint, so they're excluded naturally).
    // There is no win/loss point adjustment (that would reintroduce the fake
    // universal ELO the rating model deliberately avoids) — ratingBefore and
    // ratingAfter are equal; this just timestamps what the rating was then.
    for (const teamId of [match.teamAId, match.teamBId]) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, include: { players: true } });
      const r = avgRating(
        team.discipline,
        team.players.filter((p) => !p.isSubstitute).map((p) => p.rank)
      );
      if (r.value != null) {
        await prisma.ratingHistory.create({
          data: { teamId, matchId: id, ratingBefore: r.value, ratingAfter: r.value },
        });
      }
    }

    let champion = null;
    const advanced = await advanceWinner(prisma, match, winnerId);
    const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
    const advancedLoser = await advanceLoser(prisma, match, loserId);

    if (!advanced) {
      // No next round → this was the final.
      champion = winnerId;
      await prisma.tournament.update({
        where: { id: match.tournamentId },
        data: { status: "completed" },
      });

      const champTeam = await prisma.team.findUnique({ where: { id: winnerId } });
      const streakMatch = /^1 місце ×(\d+)$/.exec(champTeam.best ?? "");
      const nextBest = streakMatch ? `1 місце ×${Number(streakMatch[1]) + 1}` : "1 місце ×1";
      await prisma.team.update({
        where: { id: winnerId },
        data: { tournaments: { increment: 1 }, best: nextBest },
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`tournament:${match.tournamentId}`).emit("match:updated", {
        tournamentId: match.tournamentId,
        match: updated,
        advanced,
        advancedLoser,
        champion,
      });
    }

    res.json({ match: updated, advanced, advancedLoser, champion });
  })
);

// POST /api/matches/:id/reset → undo a submitted result (misclick recovery).
// Only allowed when the winner hasn't gone on to decide anything further —
// in a single-elimination tournament that just means "the next round". In a
// double-elimination one, TWO things may already have happened: the winner
// advanced (winners/losers bracket, or the grand final), AND the loser
// dropped into the losers bracket. Both must still be undoable (their own
// target match must still be "pending") before this reset is allowed — walk
// the chain backwards one step at a time (not a recursive cascade), same
// rule as before, just checked on both branches now. Byes can't be reset
// here — they're auto-resolved, not a real submitted result.
router.post(
  "/:id/reset",
  requireContentManager,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) throw new HttpError(404, "Матч не знайдено.");
    if (match.status === "bye") throw new HttpError(400, "Бай-матч не можна скасувати вручну.");
    if (match.status !== "done") throw new HttpError(400, "Цей матч ще не зіграно.");

    const winnerId = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;

    const winnerTarget = await locateWinnerTarget(prisma, match);
    const loserTarget = await locateLoserTarget(prisma, match);

    if (winnerTarget && winnerTarget.match.status !== "pending") {
      throw new HttpError(
        409,
        "Переможець уже пройшов далі, і той матч теж зіграно — спершу скасуйте результат наступного матчу."
      );
    }
    if (loserTarget && loserTarget.match.status !== "pending") {
      throw new HttpError(
        409,
        "Команда, що вибула, уже зіграла в сітці невдах — спершу скасуйте результат того матчу."
      );
    }

    let updatedNext = null;
    if (winnerTarget) {
      updatedNext = await prisma.match.update({
        where: { id: winnerTarget.match.id },
        data: { [winnerTarget.slot]: null },
      });
    } else {
      // Terminal match (single-elimination final, or the grand final) —
      // roll back the champion bookkeeping it wrote.
      const champTeam = await prisma.team.findUnique({ where: { id: winnerId } });
      const streakMatch = /^1 місце ×(\d+)$/.exec(champTeam.best ?? "");
      const n = streakMatch ? Number(streakMatch[1]) : 1;
      await prisma.team.update({
        where: { id: winnerId },
        data: {
          tournaments: { decrement: 1 },
          best: n > 1 ? `1 місце ×${n - 1}` : null,
        },
      });
      await prisma.tournament.update({ where: { id: match.tournamentId }, data: { status: "draft" } });
    }

    let updatedLoser = null;
    if (loserTarget) {
      updatedLoser = await prisma.match.update({
        where: { id: loserTarget.match.id },
        data: { [loserTarget.slot]: null },
      });
    }

    await prisma.ratingHistory.deleteMany({ where: { matchId: id } });
    const updated = await prisma.match.update({
      where: { id },
      data: { scoreA: null, scoreB: null, status: "pending" },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`tournament:${match.tournamentId}`).emit("match:updated", {
        tournamentId: match.tournamentId,
        match: updated,
        advanced: updatedNext,
        advancedLoser: updatedLoser,
        champion: null,
      });
    }

    res.json({ match: updated, nextMatch: updatedNext, loserMatch: updatedLoser });
  })
);

export default router;
