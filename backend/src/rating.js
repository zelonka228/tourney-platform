// Рейтинг команди = середнє рейтингів гравців у рідній одиниці дисципліни.
// CS2 — FACEIT ELO, Dota 2 — MMR, Valorant — звання.

export const DISCIPLINES = {
  CS2: { unit: "FACEIT ELO", kind: "number" },
  "Dota 2": { unit: "MMR", kind: "number" },
  Valorant: { unit: "звання", kind: "rank" },
};

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

export function avgRating(discipline, ranks) {
  const def = DISCIPLINES[discipline];
  if (!def || ranks.length === 0) return { label: "—", unit: def?.unit ?? "" };
  if (def.kind === "rank") {
    const idx = ranks.map((r) => VALORANT_RANKS.indexOf(r)).filter((i) => i >= 0);
    if (idx.length === 0) return { label: "—", unit: def.unit };
    const a = Math.round(idx.reduce((s, x) => s + x, 0) / idx.length);
    return { label: VALORANT_RANKS[a], unit: def.unit };
  }
  const nums = ranks.map(Number).filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return { label: "—", unit: def.unit };
  const a = Math.round(nums.reduce((s, x) => s + x, 0) / nums.length);
  return { label: String(a), unit: def.unit };
}

export function bracketPlan(n) {
  const rounds = Math.ceil(Math.log2(n));
  const full = 2 ** rounds;
  return { rounds, full, byes: full - n, matches: full - 1 };
}
