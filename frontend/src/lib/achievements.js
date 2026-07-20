import { RARITY_TIERS, teamRarity, hasTournamentWin } from "./demo";

// Список бейджів у порядку відображення. `check` отримує вже завантажену
// історію матчів команди (з useTeamMatches) — жодних додаткових запитів
// до бекенду.
export const ACHIEVEMENT_LIST = [
  {
    key: "champion",
    check: (team) => hasTournamentWin(team),
  },
  {
    key: "undefeated",
    check: (team, matches) => matches.length > 0 && matches.every((m) => m.won),
  },
  {
    key: "giantSlayer",
    check: (team, matches, teamsById) => {
      const ownTier = RARITY_TIERS.indexOf(teamRarity(team));
      return matches.some((m) => {
        if (!m.won || !m.opponentId) return false;
        const opponent = teamsById[m.opponentId];
        if (!opponent) return false;
        return RARITY_TIERS.indexOf(teamRarity(opponent)) > ownTier;
      });
    },
  },
];

/** @returns {{key: string, earned: boolean}[]} */
export function computeAchievements(team, matches, teamsById) {
  return ACHIEVEMENT_LIST.map(({ key, check }) => ({
    key,
    earned: check(team, matches, teamsById),
  }));
}
