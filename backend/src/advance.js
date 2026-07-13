// Shared bracket-advancement logic, used both when a real score is submitted
// (matches.js, forward direction) and when a result gets undone (matches.js
// /reset, backward direction) or a bye auto-resolves (tournaments.js). Round
// numbers are local to each bracket (see docs/03-double-elimination-spec.md)
// — every query here that touches `round`/`position` also filters by
// `bracket`, since e.g. "winners" round 0 and "losers" round 0 are different
// matches.
//
// `locateWinnerTarget`/`locateLoserTarget` find WHERE a match's winner/loser
// goes without writing anything — advanceWinner/advanceLoser use them to
// perform the forward write, and the /reset endpoint reuses the exact same
// destination logic to find what to clear, so the two directions can never
// drift apart from each other.
import { isPowerOfTwo, loserDestination, lbWinnerDestination } from "./bracket.js";

// Locates the target match + slot the WINNER of `match` advances into.
// `winnerId` is needed only to resolve the grand final's round 0 (whether
// the WB champion won outright, in which case there's nowhere further to
// go, vs the LB champion winning, which activates the bracket-reset match).
// Returns null for a terminal match: a single-elimination final, the
// bracket-reset match itself, or a grand-final round 0 won by the WB
// champion. `slot: null` is a special case meaning "the whole match" (the
// bracket-reset match starts empty and gets both teams copied in at once,
// not filled slot-by-slot like every other match).
export async function locateWinnerTarget(prisma, match, winnerId) {
  if (match.bracket === "final") {
    if (match.round === 1) return null;
    if (winnerId === match.teamAId) return null; // WB champion won outright
    const reset = await prisma.match.findFirst({
      where: { tournamentId: match.tournamentId, bracket: "final", round: 1 },
    });
    return reset ? { match: reset, slot: null } : null;
  }
  if (match.bracket === "losers") {
    const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: match.tournamentId } });
    const dest = lbWinnerDestination(teamCount, match.round, match.position);
    if (!dest) {
      const finalMatch = await prisma.match.findFirst({
        where: { tournamentId: match.tournamentId, bracket: "final", round: 0 },
      });
      return finalMatch ? { match: finalMatch, slot: "teamBId" } : null;
    }
    const target = await prisma.match.findFirst({
      where: { tournamentId: match.tournamentId, bracket: "losers", round: dest.round, position: dest.position },
    });
    return target ? { match: target, slot: dest.slot + "Id" } : null;
  }
  // bracket === "winners"
  const nextPosition = Math.floor(match.position / 2);
  const slot = match.position % 2 === 0 ? "teamAId" : "teamBId";
  const nextMatch = await prisma.match.findFirst({
    where: { tournamentId: match.tournamentId, bracket: "winners", round: match.round + 1, position: nextPosition },
  });
  if (nextMatch) return { match: nextMatch, slot };
  // No next winners-bracket round — either the true final (single elim), or
  // the WB final feeding the grand final (double elim, if one exists).
  const finalMatch = await prisma.match.findFirst({
    where: { tournamentId: match.tournamentId, bracket: "final", round: 0 },
  });
  return finalMatch ? { match: finalMatch, slot: "teamAId" } : null;
}

// Locates the target match + slot the LOSER of `match` drops into. Only
// winners-bracket matches in a double-elimination tournament have one —
// losers-bracket and grand-final losers are simply eliminated.
export async function locateLoserTarget(prisma, match) {
  if (match.bracket !== "winners") return null;
  const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: match.tournamentId } });
  if (!isPowerOfTwo(teamCount)) return null;
  const dest = loserDestination(teamCount, match.round, match.position);
  const target = await prisma.match.findFirst({
    where: { tournamentId: match.tournamentId, bracket: "losers", round: dest.round, position: dest.position },
  });
  return target ? { match: target, slot: dest.slot + "Id" } : null;
}

// Pushes `winnerId` into its next destination. Returns the updated match, or
// null if `match` was terminal.
export async function advanceWinner(prisma, match, winnerId) {
  const target = await locateWinnerTarget(prisma, match, winnerId);
  if (!target) return null;
  if (target.slot === null) {
    // Grand final round 0 → round 1 (bracket reset): copy both teams over.
    return prisma.match.update({
      where: { id: target.match.id },
      data: { teamAId: match.teamAId, teamBId: match.teamBId, status: "pending" },
    });
  }
  return prisma.match.update({ where: { id: target.match.id }, data: { [target.slot]: winnerId } });
}

// Routes the LOSER of a winners-bracket match into the losers bracket.
// Returns null when there's nowhere to route it (single-elimination
// tournament, or `match` isn't a winners-bracket match).
export async function advanceLoser(prisma, match, loserId) {
  const target = await locateLoserTarget(prisma, match);
  if (!target) return null;
  return prisma.match.update({ where: { id: target.match.id }, data: { [target.slot]: loserId } });
}

// Byes only ever occur in the winners bracket's round 0 (buildBracketRows
// only leaves a single null slot there; every later round starts with both
// slots null, and the losers/final brackets never have byes). Right after
// generating the bracket, auto-resolve every round-0 bye — the "bye" team
// advances immediately, since there is no opponent to submit a score
// against.
export async function resolveByes(prisma, tournamentId) {
  const round0 = await prisma.match.findMany({ where: { tournamentId, bracket: "winners", round: 0 } });
  for (const m of round0) {
    const isBye = (m.teamAId == null) !== (m.teamBId == null); // exactly one side null
    if (!isBye) continue;
    const winnerId = m.teamAId ?? m.teamBId;
    await prisma.match.update({ where: { id: m.id }, data: { status: "bye" } });
    await advanceWinner(prisma, m, winnerId);
  }
}
