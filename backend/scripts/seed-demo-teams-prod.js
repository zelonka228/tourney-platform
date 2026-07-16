// One-off admin utility: inserts the 8 demo teams (mirrors
// backend/prisma/seed.js TEAMS) into whatever database DATABASE_URL points
// at, WITHOUT touching the User table and WITHOUT deleting anything first —
// unlike prisma/seed.js, this is safe to run against a production database
// that already has real registered accounts.
//
// Idempotent: skips any team whose name already exists (Team.name is
// @unique), so re-running it is harmless.
//
// Usage (PowerShell), pointed at the production Postgres via its External
// Database URL from the Render dashboard (tourneyforge-db → Info/Connect):
//   $env:DATABASE_URL="<external db url>"
//   node scripts/seed-demo-teams-prod.js --schema=prisma/schema.production.prisma
//
// The --schema flag isn't read by this script (Prisma Client doesn't need
// it at runtime, only `prisma generate`/`db push` do) — it's just a reminder
// that the client must already be generated against schema.production.prisma
// (npm run build does this) before running this against Postgres.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function emblemLogo(color, paths) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur stdDeviation="4" result="b"/>` +
    `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter></defs>` +
    `<rect width="256" height="256" fill="#09090B"/>` +
    `<rect x="1" y="1" width="254" height="254" fill="none" stroke="#27272A" stroke-width="2"/>` +
    `<g stroke="${color}" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round" filter="url(#g)">${paths}</g>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Mirror of backend/prisma/seed.js TEAMS (and frontend/src/lib/demo.js).
const TEAMS = [
  {
    name: "Night Wolves",
    discipline: "CS2",
    logo: emblemLogo(
      "#00F0FF",
      '<path d="M90 110 L120 60 L140 110 M150 110 L180 60 L200 110"/>' +
        '<path d="M80 120 L144 200 L208 120 Z"/>'
    ),
    winrate: "71%",
    streak: "5 W",
    tournaments: 12,
    best: "1 місце ×4",
    players: [
      { nick: "s1mple_ua", role: "AWPer", rank: 2510 },
      { nick: "blaze", role: "Entry", rank: 2180 },
      { nick: "anchor", role: "Support", rank: 1990 },
      { nick: "maestro", role: "IGL", rank: 2070 },
      { nick: "ghost", role: "Lurker", rank: 2240 },
    ],
  },
  {
    name: "Iron Hawks",
    discipline: "CS2",
    logo: emblemLogo(
      "#00F0FF",
      '<path d="M70 160 L130 60 L150 90 L190 50 L170 110 L230 130 L150 140 L110 180 Z"/>'
    ),
    winrate: "61%",
    streak: "2 L",
    tournaments: 14,
    best: "1 місце ×1",
    players: [
      { nick: "falcon", role: "AWPer", rank: 2050 },
      { nick: "rush", role: "Entry", rank: 1980 },
      { nick: "wall", role: "Support", rank: 1900 },
      { nick: "brain", role: "IGL", rank: 2100 },
      { nick: "shade", role: "Lurker", rank: 2020 },
    ],
  },
  {
    name: "Void Runners",
    discipline: "Dota 2",
    logo: emblemLogo(
      "#00F0FF",
      '<circle cx="128" cy="128" r="70"/><circle cx="128" cy="128" r="44"/><circle cx="128" cy="128" r="16"/>'
    ),
    winrate: "66%",
    streak: "3 W",
    tournaments: 9,
    best: "1 місце ×2",
    players: [
      { nick: "carrygod", role: "Carry (1)", rank: 5600 },
      { nick: "midas", role: "Mid (2)", rank: 5500 },
      { nick: "offking", role: "Offlane (3)", rank: 5300 },
      { nick: "rotator", role: "Soft Support (4)", rank: 5200 },
      { nick: "warder", role: "Hard Support (5)", rank: 5400 },
    ],
  },
  {
    name: "Storm Breakers",
    discipline: "Dota 2",
    logo: emblemLogo("#DFFF00", '<path d="M160 50 L90 140 L130 140 L80 210 L170 110 L124 110 Z"/>'),
    winrate: "39%",
    streak: "1 L",
    tournaments: 3,
    best: "1/2 фіналу",
    players: [
      { nick: "young", role: "Carry (1)", rank: 4000 },
      { nick: "spark", role: "Mid (2)", rank: 3900 },
      { nick: "tank", role: "Offlane (3)", rank: 3800 },
      { nick: "helper", role: "Soft Support (4)", rank: 3850 },
      { nick: "guard", role: "Hard Support (5)", rank: 3950 },
    ],
  },
  {
    name: "Red Phoenix",
    discipline: "Valorant",
    logo: emblemLogo(
      "#FF0055",
      '<path d="M130 50 C100 100 90 140 130 200 C170 140 160 100 130 50 Z"/>' +
        '<path d="M130 100 C116 130 116 154 130 180"/>'
    ),
    winrate: "57%",
    streak: "2 W",
    tournaments: 8,
    best: "1 місце ×1",
    players: [
      { nick: "jett_main", role: "Duelist", rank: "Immortal" },
      { nick: "smoke", role: "Controller", rank: "Immortal" },
      { nick: "recon", role: "Initiator", rank: "Immortal" },
      { nick: "lock", role: "Sentinel", rank: "Diamond" },
      { nick: "flexr", role: "Flex", rank: "Immortal" },
    ],
  },
  {
    name: "Cyber Lynx",
    discipline: "Valorant",
    logo: emblemLogo(
      "#DFFF00",
      '<path d="M80 100 L104 40 L124 100 M136 100 L156 40 L180 100"/>' +
        '<path d="M74 110 L186 110 L150 170 L110 170 Z"/>' +
        '<path d="M40 130 L74 130 M186 130 L220 130"/>'
    ),
    winrate: "52%",
    streak: "1 W",
    tournaments: 6,
    best: "1/4 фіналу",
    players: [
      { nick: "dash", role: "Duelist", rank: "Diamond" },
      { nick: "haze", role: "Controller", rank: "Diamond" },
      { nick: "scan", role: "Initiator", rank: "Platinum" },
      { nick: "hold", role: "Sentinel", rank: "Diamond" },
      { nick: "swing", role: "Flex", rank: "Ascendant" },
    ],
  },
  {
    name: "Frost Giants",
    discipline: "CS2",
    logo: emblemLogo(
      "#00F0FF",
      '<path d="M60 180 L130 40 L200 180 Z"/><path d="M100 110 L130 150 L170 90"/>'
    ),
    winrate: "48%",
    streak: "1 W",
    tournaments: 5,
    best: "1/4 фіналу",
    players: [
      { nick: "ice", role: "AWPer", rank: 1800 },
      { nick: "chill", role: "Entry", rank: 1700 },
      { nick: "frost", role: "Support", rank: 1650 },
      { nick: "cold", role: "IGL", rank: 1750 },
      { nick: "snow", role: "Lurker", rank: 1720 },
    ],
  },
  {
    name: "Shadow Pact",
    discipline: "Valorant",
    logo: emblemLogo(
      "#DFFF00",
      '<path d="M130 40 L190 80 L190 160 L130 200 L70 160 L70 80 Z"/>' +
        '<path d="M100 110 L130 150 L160 110 Z" fill="#09090B"/>'
    ),
    winrate: "44%",
    streak: "2 L",
    tournaments: 4,
    best: "1/4 фіналу",
    players: [
      { nick: "wraith", role: "Duelist", rank: "Platinum" },
      { nick: "veil", role: "Controller", rank: "Platinum" },
      { nick: "omen2", role: "Initiator", rank: "Platinum" },
      { nick: "cage", role: "Sentinel", rank: "Platinum" },
      { nick: "dusk", role: "Flex", rank: "Diamond" },
    ],
  },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const t of TEAMS) {
    const existing = await prisma.team.findUnique({ where: { name: t.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.team.create({
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
            rank: String(p.rank),
            isSubstitute: false,
          })),
        },
      },
    });
    created++;
  }
  console.log(`Created ${created} teams, skipped ${skipped} already-existing.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
