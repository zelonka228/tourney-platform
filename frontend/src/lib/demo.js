// Дані застосунку та допоміжна логіка.
// Тимчасово — статичні дані; згодом замінюються на запити до API + WebSocket.

// Кожна дисципліна має власну систему рейтингу.
// Рейтинг команди = середнє рейтингів гравців у рідній одиниці гри.
export const DISCIPLINES = {
  CS2: { unit: "FACEIT ELO", kind: "number" },
  "Dota 2": { unit: "MMR", kind: "number" },
  Valorant: { unit: "звання", kind: "rank" },
};

// Звання Valorant за зростанням (для усереднення).
export const VALORANT_RANKS = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Ascendant",
  "Immortal",
  "Radiant",
];

// Середній рейтинг команди в одиниці її дисципліни.
export function avgRating(discipline, ranks) {
  const def = DISCIPLINES[discipline];
  if (!def || ranks.length === 0) return { label: "—", unit: def?.unit ?? "", value: 0 };
  if (def.kind === "rank") {
    const idx = ranks.map((r) => VALORANT_RANKS.indexOf(r)).filter((i) => i >= 0);
    const a = Math.round(idx.reduce((s, x) => s + x, 0) / idx.length);
    return { label: VALORANT_RANKS[a], unit: def.unit, value: a };
  }
  const a = Math.round(ranks.reduce((s, x) => s + Number(x), 0) / ranks.length);
  return { label: String(a), unit: def.unit, value: a };
}

// Формат матчу (best-of): скільки карт у матчі, перемога — за більшістю.
export const BEST_OF = [1, 3, 5];
export const winTarget = (bo) => Math.ceil(bo / 2); // BO1→1, BO3→2, BO5→3

// Усі допустимі рахунки для формату BO (переможець завжди є).
// Напр. BO3 → [[2,0],[2,1],[1,2],[0,2]].
export function validScorelines(bo) {
  const t = winTarget(bo);
  const out = [];
  for (let l = 0; l < t; l++) out.push([t, l]);
  for (let l = t - 1; l >= 0; l--) out.push([l, t]);
  return out;
}

// Доповнення до найближчого степеня двійки через «баї».
export function bracketPlan(n) {
  const rounds = Math.ceil(Math.log2(n));
  const full = 2 ** rounds;
  return { rounds, full, byes: full - n, matches: full - 1 };
}

// Єдине джерело даних команд: склад із рейтингами в одиниці гри.
// Рейтинг команди й рядок рейтингу обчислюються через avgRating().
export const TEAMS = [
  {
    name: "Night Wolves",
    discipline: "CS2",
    logo: null,
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
    logo: null,
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
    logo: null,
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
    logo: null,
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
    logo: null,
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
    logo: null,
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
    logo: null,
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
    logo: null,
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

// Ролі гравців залежать від дисципліни.
export const ROLES_BY_GAME = {
  CS2: ["Entry", "Support", "AWPer", "IGL", "Lurker"],
  "Dota 2": ["Carry (1)", "Mid (2)", "Offlane (3)", "Soft Support (4)", "Hard Support (5)"],
  Valorant: ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"],
};

export const DISCIPLINE_LIST = Object.keys(DISCIPLINES);
