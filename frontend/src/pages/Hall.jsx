import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams } from "../lib/api";
import { avgRating } from "../lib/demo";
import { Overline } from "../components/arena";

const TABS = ["all", "CS2", "Dota 2", "Valorant"];

export function Hall() {
  const { t } = useI18n();
  const [disc, setDisc] = useState("all");
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  const rows = teams
    .map((tm) => {
      // Рейтинг — середнє лише основного складу, підстави не враховуються.
      const r = avgRating(tm.discipline, tm.players.filter((p) => !p.isSubstitute).map((p) => p.rank));
      return {
        id: tm.id,
        name: tm.name,
        discipline: tm.discipline,
        rating: r.label,
        unitKey: r.unitKey,
        sort: r.value ?? -Infinity,
        winrate: tm.winrate,
        tournaments: tm.tournaments,
      };
    })
    .filter((tm) => disc === "all" || tm.discipline === disc)
    .sort((a, b) => (a.discipline === b.discipline ? b.sort - a.sort : a.discipline.localeCompare(b.discipline)));

  const rankColor = (i) =>
    i === 0 ? "text-volt font-black" : i === 1 ? "text-zinc-200" : i === 2 ? "text-amber-500" : "text-[#52525b]";

  return (
    <div className="py-10" data-testid="hall-page">
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
        {t("hall.title")}
      </h1>

      <div className="flex flex-wrap gap-2 mt-6">
        {TABS.map((d) => (
          <button
            key={d}
            data-testid={`hall-tab-${d}`}
            onClick={() => setDisc(d)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-sm border transition-colors ${
              disc === d ? "border-cyan text-cyan bg-cyan/10" : "border-[#27272a] text-[#a1a1aa] hover:text-white"
            }`}
          >
            {d === "all" ? t("hall.all") : d}
          </button>
        ))}
      </div>

      <div className="mt-6 border border-[#27272a] clip-corner overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left">
              {["#", t("hall.col.team"), t("hall.col.discipline"), t("hall.col.rating"), t("hall.col.winrate"), t("hall.col.tournaments")].map(
                (h) => (
                  <th key={h} className="overline px-4 py-3 border-b border-[#27272a]">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((tm, i) => (
              <motion.tr
                key={tm.id}
                data-testid={`hall-row-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group border-b border-[#27272a]/50 hover:bg-[#27272a]/30 transition-colors"
              >
                <td className={`px-4 py-3 font-mono ${rankColor(i)}`}>
                  <span className="inline-block w-0.5 h-4 bg-cyan mr-2 opacity-0 group-hover:opacity-100 transition-opacity align-middle" />
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-4 py-3 font-display font-semibold text-white">{tm.name}</td>
                <td className="px-4 py-3 font-mono text-[#a1a1aa]">{tm.discipline}</td>
                <td className="px-4 py-3 font-mono">
                  <span className="text-cyan">{tm.rating}</span>{" "}
                  <span className="text-[#52525b] text-xs">{t(`unit.${tm.unitKey}`)}</span>
                </td>
                <td className="px-4 py-3 font-mono text-white">{tm.winrate ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-[#a1a1aa]">{tm.tournaments}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[#52525b] text-xs mt-4 max-w-2xl">{t("hall.note")}</p>
    </div>
  );
}
