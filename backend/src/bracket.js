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
