import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams } from "../lib/api";
import { useTeamMatches } from "../lib/matchHistory";
import { Overline, Panel, Select } from "../components/arena";
import { Skeleton } from "../components/Skeleton";

export function Compare() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [teams, setTeams] = useState(null);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  const idA = params.get("a") ?? "";
  const idB = params.get("b") ?? "";
  const teamA = teams?.find((tm) => String(tm.id) === idA) ?? null;
  const teamB = teams?.find((tm) => String(tm.id) === idB) ?? null;

  // Two teams can only have a head-to-head record if they play the same
  // discipline — clear the other side if its team no longer matches the
  // discipline just picked here.
  function setSide(side, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(side, value);
    else next.delete(side);

    const otherSide = side === "a" ? "b" : "a";
    const picked = teams?.find((tm) => String(tm.id) === value);
    const other = teams?.find((tm) => String(tm.id) === next.get(otherSide));
    if (picked && other && other.discipline !== picked.discipline) {
      next.delete(otherSide);
    }
    setParams(next, { replace: true });
  }

  const teamsById = useMemo(
    () => Object.fromEntries((teams ?? []).map((tm) => [tm.id, tm])),
    [teams]
  );
  // Loads team A's whole match history (same hook the profile page's match
  // history panel uses) and narrows it down to games against team B — no
  // dedicated backend endpoint for "matches between exactly these two
  // teams" exists, and doesn't need to for how few tournaments this app has.
  const aMatches = useTeamMatches(teamA?.id ?? null, teamsById);
  const headToHead = useMemo(() => {
    if (!aMatches || !teamB) return null;
    return aMatches.filter((m) => m.opponentId === teamB.id);
  }, [aMatches, teamB]);

  const winsA = headToHead?.filter((m) => m.won).length ?? 0;
  const winsB = headToHead ? headToHead.length - winsA : 0;

  return (
    <div className="py-10" data-testid="compare-page">
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
        {t("compare.title")}
      </h1>
      <p className="text-[#a1a1aa] mt-2">{t("compare.sub")}</p>

      <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-end mt-8 max-w-2xl">
        <TeamPicker
          label={t("compare.teamA")}
          teams={teams}
          value={idA}
          exclude={idB}
          discipline={teamB?.discipline}
          onChange={(v) => setSide("a", v)}
        />
        <div className="hidden sm:block pb-3 text-center overline text-[#52525b]">vs</div>
        <TeamPicker
          label={t("compare.teamB")}
          teams={teams}
          value={idB}
          exclude={idA}
          discipline={teamA?.discipline}
          onChange={(v) => setSide("b", v)}
        />
      </div>

      <AnimatePresence mode="wait">
        {!teamA || !teamB ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[#52525b] text-sm mt-8"
          >
            {t("compare.pickBoth")}
          </motion.p>
        ) : (
          <motion.div
            key={`${teamA.id}-${teamB.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-8 max-w-2xl"
          >
            <Panel clip className="p-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <TeamScore id={teamA.id} name={teamA.name} wins={winsA} align="right" />
                <div className="overline text-[#52525b]">{t("compare.record")}</div>
                <TeamScore id={teamB.id} name={teamB.name} wins={winsB} align="left" />
              </div>
            </Panel>

            <Overline className="mt-6">{t("matchHistory.title")}</Overline>
            <div className="mt-3">
              {headToHead === null ? (
                <p className="text-[#52525b] text-sm">{t("matchHistory.loading")}</p>
              ) : headToHead.length === 0 ? (
                <p className="text-[#52525b] text-sm">{t("compare.noMatches")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-[#27272a]" data-testid="compare-matches">
                  {headToHead.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className={`w-1.5 h-1.5 rotate-45 shrink-0 ${m.won ? "bg-cyan" : "bg-[#ff0055]"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">
                          {m.won ? teamA.name : teamB.name}
                          <span className="text-[#52525b]"> {t("compare.beat")} </span>
                          {m.won ? teamB.name : teamA.name}
                        </div>
                        <div className="text-[11px] font-mono text-[#71717a] truncate">
                          {m.tournamentName}
                          {m.tournamentDate ? ` · ${m.tournamentDate}` : ""}
                        </div>
                      </div>
                      <span className="font-mono text-sm shrink-0 text-white">
                        {m.won ? `${m.ownScore}:${m.oppScore}` : `${m.oppScore}:${m.ownScore}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamPicker({ label, teams, value, exclude, discipline, onChange }) {
  return (
    <label className="block">
      <span className="overline block mb-2">{label}</span>
      {teams === null ? (
        <Skeleton className="h-[42px] w-full" />
      ) : (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {teams
            .filter((tm) => String(tm.id) !== exclude)
            .filter((tm) => !discipline || tm.discipline === discipline)
            .map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name} · {tm.discipline}
              </option>
            ))}
        </Select>
      )}
    </label>
  );
}

function TeamScore({ id, name, wins, align }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <Link
        to={`/profile/${id}`}
        className="font-display font-bold text-white truncate hover:text-cyan transition-colors block"
      >
        {name}
      </Link>
      <div className="font-mono text-4xl text-cyan mt-1">{wins}</div>
    </div>
  );
}
