// Seed script: clears existing rows and inserts the 8 demo teams (with players).
// Source data mirrors frontend/src/lib/demo.js TEAMS. Player.rank stored as String.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Пробні лого команд — inline SVG data URI (квадрат з ініціалами), той самий
// формат data URL, що продукує завантаження лого через Team.jsx (canvas →
// base64), тож рендериться однаково в Profile.jsx/Team.jsx без жодних змін.
function svgLogo(bg, text) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<rect width="256" height="256" fill="${bg}"/>` +
    `<text x="128" y="128" font-family="Arial, sans-serif" font-size="96" font-weight="700" ` +
    `fill="#fff" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Mirror of the frontend TEAMS array (frontend/src/lib/demo.js).
const TEAMS = [
  {
    name: "Night Wolves",
    discipline: "CS2",
    logo: svgLogo("#1f2430", "NW"),
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
    logo: svgLogo("#4a5568", "IH"),
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
    logo: svgLogo("#7c3aed", "VR"),
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
    logo: svgLogo("#0f766e", "SB"),
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
    logo: svgLogo("#dc2626", "RP"),
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
    logo: svgLogo("#0891b2", "CL"),
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
    logo: svgLogo("#60a5fa", "FG"),
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
    logo: svgLogo("#1e1b4b", "SP"),
    winrate: "44%",
    streak: "2 L",
    tournaments: 4,
    best: "1/4 фіналу",
    players: [
      { nick: "wraith", role: "Duelist", rank: "Platinum" },
      { nick: "veil", role: "Controller", rank: "Diamond" },
      { nick: "omen2", role: "Initiator", rank: "Platinum" },
      { nick: "cage", role: "Sentinel", rank: "Platinum" },
      { nick: "dusk", role: "Flex", rank: "Diamond" },
    ],
  },
];

async function main() {
  // Clear existing rows (respect FK order).
  await prisma.ratingHistory.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentTeam.deleteMany();
  await prisma.player.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.team.deleteMany();

  for (const t of TEAMS) {
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
            rank: String(p.rank), // always store rank as text
            isSubstitute: false,
          })),
        },
      },
    });
  }

  const count = await prisma.team.count();
  console.log(`Seeded ${count} teams.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
