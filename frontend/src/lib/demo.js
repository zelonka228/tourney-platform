// Довідники дисциплін, ролей, рангів + формули рейтингу та сітки.
// unitKey ('elo'|'mmr'|'rank') перекладається у компонентах через t();
// unit лишається як текстовий фолбек для місць, де немає доступу до i18n
// (напр. api.js demo-фолбек, коли бекенд недоступний).

export const DISCIPLINE_LIST = ["CS2", "Dota 2", "Valorant"];

export const DISCIPLINES = {
  CS2: { unit: "FACEIT ELO", unitKey: "elo", kind: "elo" },
  "Dota 2": { unit: "MMR", unitKey: "mmr", kind: "mmr" },
  Valorant: { unit: "звання", unitKey: "rank", kind: "rank" },
};

// Ролі гравців залежать від дисципліни. Порядок і написання ("Carry (1)"
// тощо) збігаються з backend/prisma/seed.js — реальними даними в БД.
export const ROLES_BY_GAME = {
  CS2: ["Entry", "Support", "AWPer", "IGL", "Lurker"],
  "Dota 2": ["Carry (1)", "Mid (2)", "Offlane (3)", "Soft Support (4)", "Hard Support (5)"],
  Valorant: ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"],
};

// Звання Valorant за зростанням (для усереднення).
export const VALORANT_RANKS = [
  "Iron", "Bronze", "Silver", "Gold", "Platinum",
  "Diamond", "Ascendant", "Immortal", "Radiant",
];

export const BEST_OF = [1, 3, 5];
export const winTarget = (bo) => Math.ceil(bo / 2); // BO1→1, BO3→2, BO5→3

// Усі допустимі рахунки для формату BO (переможець завжди є).
export function validScorelines(bo) {
  const t = winTarget(bo);
  const out = [];
  for (let l = 0; l < t; l++) out.push([t, l]);
  for (let l = t - 1; l >= 0; l--) out.push([l, t]);
  return out;
}

const nextPow2 = (n) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

// Доповнення до найближчого степеня двійки через «баї».
export function bracketPlan(n) {
  const full = nextPow2(Math.max(n, 1));
  return {
    full,
    rounds: Math.max(Math.log2(full), 0),
    matches: Math.max(full - 1, 0),
    byes: full - n,
  };
}

// Стандартний порядок посіву в сітці (1-indexed seeds у порядку слотів).
// Дзеркалить backend/src/bracket.js seedOrder() — та сама формула (перевірено
// збіг для розмірів 2/4/8: [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6]).
export function seedPositions(size) {
  let seeds = [1];
  while (seeds.length < size) {
    const len = seeds.length * 2 + 1;
    const round = [];
    for (const s of seeds) {
      round.push(s);
      round.push(len - s);
    }
    seeds = round;
  }
  return seeds;
}

// Середній рейтинг команди в одиниці її дисципліни.
export function avgRating(discipline, ranks) {
  const def = DISCIPLINES[discipline];
  if (!def || !ranks?.length) return { value: null, label: "—", unit: def?.unit ?? "", unitKey: def?.unitKey ?? "elo" };
  if (def.kind === "rank") {
    const idxs = ranks.map((r) => Math.max(VALORANT_RANKS.indexOf(r), 0));
    const avg = Math.round(idxs.reduce((a, b) => a + b, 0) / idxs.length);
    return { value: avg, label: VALORANT_RANKS[avg] ?? "—", unit: def.unit, unitKey: "rank" };
  }
  // Number("") === 0, not NaN — treat blank/whitespace-only ranks as missing
  // instead of silently averaging them in as a rating of 0.
  const nums = ranks
    .map((r) => (typeof r === "string" && r.trim() === "" ? NaN : Number(r)))
    .filter((n) => !Number.isNaN(n));
  if (!nums.length) return { value: null, label: "—", unit: def.unit, unitKey: def.unitKey };
  const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  return { value: avg, label: String(avg), unit: def.unit, unitKey: def.unitKey };
}

// Демо-команди для м'якого фолбеку в lib/api.js, коли бекенд недоступний.
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
