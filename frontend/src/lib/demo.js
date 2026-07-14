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

// Double elimination (v1) only supports team counts that are already a
// power of two — see docs/03-double-elimination-spec.md. Mirrors
// backend/src/bracket.js isPowerOfTwo().
export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

// Losers-bracket round/winner-destination math for rendering the double-elim
// bracket client-side. Mirrors backend/src/bracket.js exactly (see
// docs/03-double-elimination-spec.md for the derivation) — kept in lockstep
// with the server so the wires drawn here always match how the server will
// actually advance a result.
export function winnersRoundCount(n) {
  return Math.log2(n);
}

export function losersRoundCount(n) {
  return 2 * (winnersRoundCount(n) - 1);
}

// Where does the WINNER of losers-bracket match (lbRound, lbPosition) go
// next? Returns null when `lbRound` is the last losers-bracket round (that
// winner heads to the grand final instead, not drawn as a wire here).
export function lbWinnerDestination(n, lbRound, lbPosition) {
  const last = losersRoundCount(n) - 1;
  if (lbRound === last) return null;
  if (lbRound % 2 === 0) return { round: lbRound + 1, position: lbPosition };
  return { round: lbRound + 1, position: Math.floor(lbPosition / 2) };
}

// Where does the LOSER of winners-bracket match (wbRound, wbPosition) land
// in the losers bracket? Drawn as a second, danger-colored wire alongside
// the winner wire so a loss visibly "drops" into the losers bracket instead
// of just vanishing.
export function loserDestination(n, wbRound, wbPosition) {
  if (wbRound === 0) {
    return { round: 0, position: Math.floor(wbPosition / 2) };
  }
  return { round: 2 * wbRound - 1, position: wbPosition };
}

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

// Рідкість RPG-картки команди — від кількості виграних турнірів, а не від
// рейтингу гравців: рейтинг у трьох дисциплінах виражений у несумісних
// одиницях (FACEIT ELO, MMR, Valorant-звання), тому чесне порівняння між
// ними неможливе без вигаданої нормалізації, якої проєкт свідомо уникає.
// Перемоги в турнірах — єдина метрика, однаково чесна для всіх дисциплін.
//
// team.tournaments НЕ можна брати саме собою: бекенд інкрементує це поле
// лише при перемозі у фіналі (backend/src/routes/matches.js), але в
// сід-даних (backend/prisma/seed.js) те саме поле подекуди заповнене як
// декоративне "скільки турнірів зіграно" для команд, які НІКОЛИ не
// перемагали (напр. team.best === "1/4 фіналу") — для таких рядків
// team.tournaments не має нічого спільного з перемогами. team.best,
// натомість, бекенд пише виключно у форматі "1 місце ×N" і лише при
// реальній перемозі — це єдиний надійний сигнал "команда взагалі колись
// вигравала". Тому: немає матчу формату → команда не вигравала → Common,
// незалежно від team.tournaments.
export function teamRarity(team) {
  if (!/^1 місце ×\d+$/.test(team.best ?? "")) return "Common";
  const wins = team.tournaments ?? 0;
  if (wins >= 3) return "Legendary";
  if (wins === 2) return "Epic";
  return "Rare";
}

// Середній рейтинг команди в одиниці її дисципліни.
export function avgRating(discipline, ranks) {
  const def = DISCIPLINES[discipline];
  if (!def || !ranks?.length)
    return { value: null, label: "—", unit: def?.unit ?? "", unitKey: def?.unitKey ?? "elo" };
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

// HenrikDev's tier name is e.g. "Diamond 2" or "Immortal 3" (sub-tier
// number appended) while "Radiant"/"Unrated" have none — strip a trailing
// " <digits>" and match against our own (sub-tier-less) VALORANT_RANKS.
// "Unrated" (and anything else unrecognized) intentionally returns null so
// callers fall back to the manually-entered rank instead of showing "—".
function mapValorantRankLabel(label) {
  if (!label) return null;
  const base = label.replace(/\s+\d+$/, "").trim();
  return VALORANT_RANKS.includes(base) ? base : null;
}

// Extracts the live rank value (in our internal unit) from a fetched stats
// payload, or null if that discipline/payload doesn't carry one we can use.
export function liveRankFromStats(discipline, stats) {
  if (!stats) return null;
  if (discipline === "CS2") return stats.eloOrMmr ?? null;
  if (discipline === "Valorant") return mapValorantRankLabel(stats.rank?.label);
  return null;
}

// If a player has a linked external profile and we already have its cached
// stats, their live rank is the same unit as our internal rank field — use
// it instead of the manually-entered value so the roster row and the
// average rating don't silently drift from what the widget shows. Dota 2
// never qualifies: it has no integration (Valve hides numeric MMR), so its
// roster is manual-entry only.
export function effectivePlayerRank(discipline, player) {
  if (player.externalStats) {
    try {
      const live = liveRankFromStats(discipline, JSON.parse(player.externalStats));
      if (live != null) return live;
    } catch {
      // Malformed cache — fall through to the manual rank.
    }
  }
  return player.rank;
}

// Same idea as liveRankFromStats, but for the display name. FACEIT's
// displayName is already a plain nickname; Valorant's is the full Riot ID
// ("name#tag") since the tag disambiguates accounts inside the widget's own
// header — strip it back down to just the name for the roster row, where
// it reads as a nickname alongside every other discipline's.
export function liveNickFromStats(discipline, stats) {
  if (!stats?.displayName) return null;
  if (discipline === "Valorant") return stats.displayName.split("#")[0];
  return stats.displayName;
}

export function effectivePlayerNick(discipline, player) {
  if (player.externalStats) {
    try {
      const live = liveNickFromStats(discipline, JSON.parse(player.externalStats));
      if (live) return live;
    } catch {
      // Malformed cache — fall through to the manual nick.
    }
  }
  return player.nick;
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
