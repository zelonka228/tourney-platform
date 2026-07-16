// One-off migration: copies ALL teams + tournaments (with brackets/matches)
// captured from the local dev backend into whatever DATABASE_URL points at
// (the production Postgres). Does NOT touch the User table.
//
// Reads from pre-fetched JSON snapshots rather than hitting localhost:4000
// live — the local backend has to be STOPPED while the Prisma Client is
// regenerated against schema.production.prisma (Windows locks the query
// engine .dll while a process holds it), so the two can't run at once.
// Snapshot the data first while the local backend is still up:
//   curl http://localhost:4000/api/teams -o teams.json
//   curl http://localhost:4000/api/tournaments -o tournaments-list.json
//   (then fetch /api/tournaments/:id for every id into tournaments-full.json)
//
// Safe to re-run: teams are matched/skipped by name (Team.name is
// @unique); tournaments are always inserted fresh (no unique constraint on
// Tournament.name) — re-running this script duplicates tournaments, so
// don't run it twice against the same target without clearing first.
//
// Usage (PowerShell), pointed at the target Postgres via its External
// Database URL, with the Prisma Client already generated against
// schema.production.prisma (npx prisma generate --schema=prisma/schema.production.prisma):
//   $env:DATABASE_URL="<external db url>"
//   node scripts/migrate-local-to-prod.js <teams.json> <tournaments-full.json>
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const [teamsPath, tournamentsPath] = process.argv.slice(2);
  if (!teamsPath || !tournamentsPath) {
    throw new Error("Usage: node migrate-local-to-prod.js <teams.json> <tournaments-full.json>");
  }
  const localTeams = JSON.parse(readFileSync(teamsPath, "utf8"));
  const localTournaments = JSON.parse(readFileSync(tournamentsPath, "utf8"));

  // --- Teams: create missing ones, sync stat fields on existing ones ---
  let teamsCreated = 0;
  let teamsSynced = 0;
  const nameToProdId = new Map();

  for (const t of localTeams) {
    const existing = await prisma.team.findUnique({ where: { name: t.name } });
    if (existing) {
      await prisma.team.update({
        where: { id: existing.id },
        data: {
          winrate: t.winrate,
          streak: t.streak,
          tournaments: t.tournaments,
          best: t.best,
        },
      });
      nameToProdId.set(t.name, existing.id);
      teamsSynced++;
      continue;
    }
    const created = await prisma.team.create({
      data: {
        name: t.name,
        discipline: t.discipline,
        logo: t.logo,
        winrate: t.winrate,
        streak: t.streak,
        tournaments: t.tournaments,
        best: t.best,
        players: {
          create: t.players.map((p) => ({
            nick: p.nick,
            role: p.role,
            rank: p.rank,
            isSubstitute: p.isSubstitute,
            externalRef: p.externalRef ?? null,
          })),
        },
      },
    });
    nameToProdId.set(t.name, created.id);
    teamsCreated++;
  }

  const localIdToName = new Map(localTeams.map((t) => [t.id, t.name]));
  const localIdToProdId = (localId) => {
    const name = localIdToName.get(localId);
    return name ? nameToProdId.get(name) : undefined;
  };

  // --- Tournaments: create with remapped team/match references ---
  let tournamentsCreated = 0;
  for (const tour of localTournaments) {
    const tournament = await prisma.tournament.create({
      data: {
        name: tour.name,
        discipline: tour.discipline,
        bracketType: tour.bracketType,
        matchFormat: tour.matchFormat,
        status: tour.status,
        date: tour.date,
        teams: {
          create: tour.teams
            .map((tt) => ({ teamId: localIdToProdId(tt.teamId), seed: tt.seed }))
            .filter((tt) => tt.teamId !== undefined),
        },
        matches: {
          create: tour.matches.map((m) => ({
            round: m.round,
            position: m.position,
            teamAId: m.teamAId != null ? localIdToProdId(m.teamAId) : null,
            teamBId: m.teamBId != null ? localIdToProdId(m.teamBId) : null,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            status: m.status,
            bracket: m.bracket,
          })),
        },
      },
    });
    tournamentsCreated++;
    console.log(`  + tournament #${tournament.id} "${tour.name}" (was local #${tour.id})`);
  }

  console.log(
    `\nTeams: ${teamsCreated} created, ${teamsSynced} synced. Tournaments: ${tournamentsCreated} created.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
