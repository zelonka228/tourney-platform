// Портретна RPG-картка команди — окремий макет під PNG-експорт
// (docs/04-rpg-card-spec.md), не знімок наявної панелі /profile.
import { forwardRef } from "react";
import { useI18n } from "../lib/i18n";
import {
  avgRating,
  effectivePlayerRank,
  effectivePlayerNick,
  teamRarity,
  DISCIPLINES,
} from "../lib/demo";

const RARITY_STYLE = {
  Common: {
    border: "border-[#3f3f46]",
    text: "text-[#a1a1aa]",
    glow: "",
  },
  Rare: {
    border: "border-cyan",
    text: "text-cyan",
    glow: "shadow-[0_0_12px_rgba(0,240,255,0.25)]",
  },
  Epic: {
    border: "border-volt",
    text: "text-volt",
    glow: "shadow-[0_0_16px_rgba(223,255,0,0.3)]",
  },
  Legendary: {
    border: "border-volt",
    text: "text-volt",
    glow: "shadow-[0_0_28px_rgba(223,255,0,0.55)]",
  },
};

// forwardRef — html-to-image потребує пряме посилання на DOM-вузол картки,
// щоб знімати саме його, а не весь вміст модалки навколо.
export const TeamCard = forwardRef(function TeamCard({ team }, ref) {
  const { t } = useI18n();
  const mainPlayers = team.players.filter((p) => !p.isSubstitute);
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);
  const rating = avgRating(
    team.discipline,
    mainPlayers.map((p) => effectivePlayerRank(team.discipline, p))
  );
  const rarity = teamRarity(team);
  const style = RARITY_STYLE[rarity];

  return (
    <div
      ref={ref}
      className={`w-[600px] bg-void border-2 ${style.border} ${style.glow} font-sans flex flex-col`}
    >
      <div className="p-6 flex flex-col items-center border-b border-[#27272a] bg-surface/60">
        <div className="w-28 h-28 border border-[#27272a] bg-void grid place-items-center overflow-hidden">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-6 h-6 border border-cyan/40 rotate-45" />
          )}
        </div>
        <h2 className="font-display font-black text-3xl text-white text-center mt-4">
          {team.name}
        </h2>
        <div className="flex gap-2 mt-3">
          <span className="px-3 py-1 text-xs font-mono border border-[#27272a] text-[#a1a1aa] rounded-sm">
            {team.discipline}
          </span>
          <span
            className={`px-3 py-1 text-xs font-mono border rounded-sm ${style.border} ${style.text}`}
          >
            {rarity}
          </span>
        </div>
      </div>

      <div className="p-6 text-center border-b border-[#27272a]">
        <div className="overline text-[#a1a1aa]">{t("profile.rating")}</div>
        <div className="font-mono text-5xl text-cyan mt-2">{rating.label}</div>
        <div className="overline mt-1">{unit}</div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-[#27272a] border-b border-[#27272a]">
        <CardStat value={team.winrate ?? "—"} label={t("profile.winrate")} />
        <CardStat value={team.streak ?? "—"} label={t("profile.streak")} accent="volt" />
        <CardStat value={team.tournaments} label={t("profile.tournaments")} />
        <CardStat value={team.best ?? "—"} label={t("profile.best")} accent="volt" />
      </div>

      <div className="p-6 flex-1">
        <div className="overline text-[#a1a1aa] mb-3">{t("profile.roster")}</div>
        <div className="divide-y divide-[#27272a]/60">
          {mainPlayers.map((p, i) => (
            <div key={p.id ?? `${p.nick}-${i}`} className="flex items-center gap-3 py-2">
              <span className="w-1.5 h-1.5 rotate-45 shrink-0 bg-cyan/60" />
              <div className="min-w-0">
                <div className="text-sm text-white truncate">
                  {effectivePlayerNick(team.discipline, p)}
                </div>
                <div className="text-[11px] font-mono text-[#a1a1aa]">{p.role}</div>
              </div>
              <span className="ml-auto font-mono text-sm text-cyan">
                {effectivePlayerRank(team.discipline, p)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 text-center text-[10px] font-mono tracking-widest text-[#52525b] border-t border-[#27272a]">
        TOURNEYFORGE
      </div>
    </div>
  );
});

function CardStat({ value, label, accent = "cyan" }) {
  const color = accent === "volt" ? "text-volt" : "text-cyan";
  return (
    <div className="p-4 bg-void/40 text-center">
      <div className={`font-mono text-lg leading-none ${color}`}>{value}</div>
      <div className="overline mt-2">{label}</div>
    </div>
  );
}
