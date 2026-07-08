// Shared bracket-advancement logic, used both when a real score is submitted
// (matches.js) and when a bye needs to auto-resolve right after bracket
// generation (tournaments.js) — same position/round math either way.

// Pushes `winnerId` into the next round's match slot for `match`.
// Returns the updated next-round match, or null if `match` was the final.
export async function advanceWinner(prisma, match, winnerId) {
  const nextPosition = Math.floor(match.position / 2);
  const slot = match.position % 2 === 0 ? "teamAId" : "teamBId";
  const nextMatch = await prisma.match.findFirst({
    where: { tournamentId: match.tournamentId, round: match.round + 1, position: nextPosition },
  });
  if (!nextMatch) return null;
  return prisma.match.update({ where: { id: nextMatch.id }, data: { [slot]: winnerId } });
}

// Byes only ever occur in round 0 (buildBracketRows only leaves a single null
// slot there; every later round starts with both slots null). Right after
// generating the bracket, auto-resolve every round-0 bye — the "bye" team
// advances immediately, since there is no opponent to submit a score against.
export async function resolveByes(prisma, tournamentId) {
  const round0 = await prisma.match.findMany({ where: { tournamentId, round: 0 } });
  for (const m of round0) {
    const isBye = (m.teamAId == null) !== (m.teamBId == null); // exactly one side null
    if (!isBye) continue;
    const winnerId = m.teamAId ?? m.teamBId;
    await prisma.match.update({ where: { id: m.id }, data: { status: "bye" } });
    await advanceWinner(prisma, m, winnerId);
  }
}
