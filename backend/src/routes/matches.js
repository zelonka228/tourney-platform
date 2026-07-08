// Matches API — score submission, winner advancement, live updates.
import { Router } from "express";
import prisma from "../db.js";
import { isValidScore } from "../bracket.js";
import { advanceWinner } from "../advance.js";
import { avgRating } from "../rating.js";
import { asyncHandler, requireFields, HttpError } from "../http.js";

const router = Router();

// PUT /api/matches/:id/score → submit a match result.
// Validates the score against the tournament's matchFormat, marks the match
// done, pushes the winner into the next round's match slot, and snapshots
// both teams' current rating into RatingHistory. If there is no next round
// (this was the final), also marks the tournament completed and updates the
// champion's stats.
router.put(
  "/:id/score",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
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

    const updated = await prisma.match.update({
      where: { id },
      data: { scoreA: a, scoreB: b, status: "done" },
    });

    // Snapshot both teams' current rating into history for every played match
    // (byes don't go through this endpoint, so they're excluded naturally).
    // There is no win/loss point adjustment (that would reintroduce the fake
    // universal ELO the rating model deliberately avoids) — ratingBefore and
    // ratingAfter are equal; this just timestamps what the rating was then.
    for (const teamId of [match.teamAId, match.teamBId]) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, include: { players: true } });
      const r = avgRating(team.discipline, team.players.map((p) => p.rank));
      if (r.value != null) {
        await prisma.ratingHistory.create({
          data: { teamId, matchId: id, ratingBefore: r.value, ratingAfter: r.value },
        });
      }
    }

    let champion = null;
    const advanced = await advanceWinner(prisma, match, winnerId);

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
        champion,
      });
    }

    res.json({ match: updated, advanced, champion });
  })
);

export default router;
