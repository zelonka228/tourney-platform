// Чиста логіка турнірної сітки (single elimination). Дзеркалить
// frontend/src/lib/demo.js та frontend/src/pages/Tournament.jsx — та сама
// формула посіву й валідних рахунків має діяти однаково на клієнті й сервері.
import { bracketPlan } from "./rating.js";

// Стандартний порядок посіву: розмір 8 → [1,8,4,5,2,7,3,6], щоб найсильніші
// посіви грали проти найслабших (і саме вони отримували «бай» першими).
export function seedOrder(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

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

export function isValidScore(bo, scoreA, scoreB) {
  return validScorelines(bo).some(([a, b]) => a === scoreA && b === scoreB);
}

// Будує рядки для Match-таблиці одного турніру за посівом teamIds (у порядку
// реєстрації = порядок посіву). 1-й раунд заповнений за seedOrder (з баями —
// null замість команди, якщо учасників менше за найближчий степінь двійки).
// Наступні раунди — порожні слоти, заповнюються по мірі завершення матчів.
export function buildBracketRows(teamIds) {
  const n = teamIds.length;
  const plan = bracketPlan(n);
  const order = seedOrder(plan.full);
  const rows = [];

  for (let m = 0; m < plan.full / 2; m++) {
    const seedA = order[m * 2];
    const seedB = order[m * 2 + 1];
    rows.push({
      round: 0,
      position: m,
      teamAId: seedA <= n ? teamIds[seedA - 1] : null,
      teamBId: seedB <= n ? teamIds[seedB - 1] : null,
    });
  }

  for (let r = 1; r < plan.rounds; r++) {
    const count = plan.full / 2 ** (r + 1);
    for (let m = 0; m < count; m++) {
      rows.push({ round: r, position: m, teamAId: null, teamBId: null });
    }
  }

  return rows;
}

// ---- Double elimination (losers bracket) ----
// See docs/03-double-elimination-spec.md for the derivation. Only supports
// power-of-two team counts for now — arbitrary counts would need byes seeded
// into the losers bracket too (avoiding early rematches around the bye),
// which is deliberately out of scope for the first version.

export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

// Number of winners-bracket rounds (0-indexed 0..k-1, k-1 is the WB final).
export function winnersRoundCount(n) {
  return Math.log2(n);
}

// Total losers-bracket rounds: 2*(k-1) for k winners-bracket rounds. Round 0
// pairs WB round-0's losers against each other. After that, rounds
// alternate "drop" (pairs the previous LB round's survivors against the
// next fresh batch of WB losers) and "minor" (pairs the previous LB round's
// survivors against each other, no fresh blood), ending on a drop round fed
// by the WB final's loser — that round's winner is the losers-bracket
// champion.
export function losersRoundCount(n) {
  return 2 * (winnersRoundCount(n) - 1);
}

function losersRoundMatchCount(n, lbRound) {
  if (lbRound === 0) return n / 4;
  if (lbRound % 2 === 1) {
    // Drop round fed by WB round `wbRound`'s losers — always the same match
    // count as that WB round, since the LB survivor pool arriving here is
    // by construction equal in size to it.
    const wbRound = (lbRound + 1) / 2;
    return n / 2 ** (wbRound + 1);
  }
  return losersRoundMatchCount(n, lbRound - 1) / 2; // minor round: half the preceding drop round
}

// Builds the empty losers-bracket Match rows (teams filled in later, as WB
// and LB matches complete) for a power-of-two team count.
export function buildLosersBracketRows(n) {
  const rows = [];
  for (let r = 0; r < losersRoundCount(n); r++) {
    const count = losersRoundMatchCount(n, r);
    for (let m = 0; m < count; m++) {
      rows.push({ round: r, position: m, teamAId: null, teamBId: null, bracket: "losers" });
    }
  }
  return rows;
}

// Where does the LOSER of winners-bracket match (wbRound, wbPosition) land
// in the losers bracket? WB round 0's losers pair against each other
// directly; every later WB round's losers drop into slot "teamB" of a
// specific LB "drop" round (see losersRoundMatchCount above) — slot "teamA"
// there is reserved for whichever LB survivor already made it that far.
export function loserDestination(n, wbRound, wbPosition) {
  if (wbRound === 0) {
    return {
      round: 0,
      position: Math.floor(wbPosition / 2),
      slot: wbPosition % 2 === 0 ? "teamA" : "teamB",
    };
  }
  return { round: 2 * wbRound - 1, position: wbPosition, slot: "teamB" };
}

// Grand-final row: one match, WB champion vs LB champion. Whoever wins it
// is the tournament champion outright — no bracket reset (a second,
// decisive match if the LB champion wins) — that's deliberately out of
// scope, see docs/03-double-elimination-spec.md.
export function buildFinalRows() {
  return [{ round: 0, position: 0, teamAId: null, teamBId: null, bracket: "final" }];
}

// Where does the WINNER of losers-bracket match (lbRound, lbPosition) go
// next? Returns null when `lbRound` is the last losers-bracket round — that
// winner is the losers-bracket champion, headed to the grand final instead
// (handled by the caller, see advance.js).
export function lbWinnerDestination(n, lbRound, lbPosition) {
  const last = losersRoundCount(n) - 1;
  if (lbRound === last) return null;
  if (lbRound % 2 === 0) {
    // Round 0, or a minor round → next is a drop round, same position,
    // teamA (teamB is reserved for that round's fresh WB loser).
    return { round: lbRound + 1, position: lbPosition, slot: "teamA" };
  }
  // Drop round (not the last one) → followed by a minor round that pairs
  // its two winners together.
  return {
    round: lbRound + 1,
    position: Math.floor(lbPosition / 2),
    slot: lbPosition % 2 === 0 ? "teamA" : "teamB",
  };
}
