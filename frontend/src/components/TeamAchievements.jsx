import { useI18n } from "../lib/i18n";
import { useTeamMatches } from "../lib/matchHistory";
import { computeAchievements } from "../lib/achievements";

// Мінімалістичні геометричні іконки (лінія, без заливки), в стилі решти
// проєкту (arena.jsx) — колір іде через currentColor, а не хардкод.
const ICON_PATHS = {
  champion: (
    <>
      <rect
        x="9"
        y="9"
        width="14"
        height="14"
        transform="rotate(45 16 16)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    </>
  ),
  undefeated: (
    <path
      d="M16 4 L26 9 V19 C26 24 21 27.5 16 29 C11 27.5 6 24 6 19 V9 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
  giantSlayer: (
    <>
      <path
        d="M8 15 L16 7 L24 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 25 L16 17 L24 25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

export function TeamAchievements({ team, teamsById }) {
  const { t } = useI18n();
  const matches = useTeamMatches(team.id, teamsById);

  if (matches === null) {
    return <p className="text-[#52525b] text-sm">{t("matchHistory.loading")}</p>;
  }

  const badges = computeAchievements(team, matches, teamsById);

  return (
    <div className="grid grid-cols-3 gap-3" data-testid="achievements-grid">
      {badges.map(({ key, earned }) => (
        <div
          key={key}
          data-testid={`achievement-${key}`}
          data-earned={earned}
          className={`flex flex-col items-center text-center gap-2 p-3 border rounded-sm transition-colors ${
            earned ? "border-cyan/50 bg-cyan/5 text-cyan" : "border-[#27272a] text-[#52525b] opacity-50"
          }`}
        >
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            {ICON_PATHS[key]}
          </svg>
          <div className="text-[11px] font-mono font-bold uppercase tracking-wide leading-tight">
            {t(`achievements.${key}.name`)}
          </div>
          <div className="text-[10px] text-[#71717a] leading-snug">
            {t(`achievements.${key}.desc`)}
          </div>
        </div>
      ))}
    </div>
  );
}
