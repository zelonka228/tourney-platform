import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { getTournaments, getTournament } from "../lib/api";

// Немає окремого бекенд-ендпоінту "матчі команди X" (Match зберігає лише
// teamAId/teamBId, без зв'язку назад до команди) — тому будуємо історію на
// фронтенді з уже наявних викликів: GET /api/tournaments (список із
// вкладеними TournamentTeam, щоб відсіяти турніри, де команда взагалі
// грала) + GET /api/tournaments/:id (повні матчі) лише для тих турнірів.
// Кількість турнірів у цьому застосунку невелика (навчальний проєкт), тож
// N+1 запитів тут прийнятні — окремий бекенд-роут був би "правильнішим",
// але зайвим для цього масштабу.
export function TeamMatchHistory({ teamId, teamsById }) {
  const { t } = useI18n();
  const [matches, setMatches] = useState(null); // null = ще завантажується

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const tournaments = await getTournaments();
      const relevant = tournaments.filter((tr) => tr.teams.some((tt) => tt.teamId === teamId));
      const full = await Promise.all(relevant.map((tr) => getTournament(tr.id)));
      if (cancelled) return;
      const rows = full.flatMap((tr) =>
        tr.matches
          .filter((m) => m.status === "done" && (m.teamAId === teamId || m.teamBId === teamId))
          .map((m) => {
            const isTeamA = m.teamAId === teamId;
            const ownScore = isTeamA ? m.scoreA : m.scoreB;
            const oppScore = isTeamA ? m.scoreB : m.scoreA;
            const oppId = isTeamA ? m.teamBId : m.teamAId;
            return {
              id: m.id,
              tournamentName: tr.name,
              tournamentDate: tr.date,
              opponentId: oppId,
              opponentName: oppId ? teamsById[oppId]?.name : null,
              ownScore,
              oppScore,
              won: ownScore > oppScore,
            };
          })
      );
      rows.sort((a, b) => {
        if (a.tournamentDate && b.tournamentDate) return b.tournamentDate.localeCompare(a.tournamentDate);
        return b.id - a.id;
      });
      setMatches(rows);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (matches === null) {
    return <p className="text-[#52525b] text-sm">{t("matchHistory.loading")}</p>;
  }
  if (matches.length === 0) {
    return <p className="text-[#52525b] text-sm">{t("matchHistory.empty")}</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-[#27272a]">
      {matches.map((m) => (
        <div key={m.id} className="flex items-center gap-3 py-2.5" data-testid={`match-history-${m.id}`}>
          <span className={`w-1.5 h-1.5 rotate-45 shrink-0 ${m.won ? "bg-cyan" : "bg-[#52525b]"}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white truncate">
              {m.opponentId ? (
                <Link to={`/team/${m.opponentId}`} className="hover:underline hover:text-cyan">
                  {m.opponentName ?? t("matchHistory.unknownOpponent")}
                </Link>
              ) : (
                t("matchHistory.bye")
              )}
            </div>
            <div className="text-[11px] font-mono text-[#71717a] truncate">
              {m.tournamentName}
              {m.tournamentDate ? ` · ${m.tournamentDate}` : ""}
            </div>
          </div>
          <span className={`font-mono text-sm shrink-0 ${m.won ? "text-cyan" : "text-[#a1a1aa]"}`}>
            {m.ownScore}:{m.oppScore}
          </span>
          <span
            className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm shrink-0 ${
              m.won ? "text-cyan border border-cyan/40" : "text-[#52525b] border border-[#3f3f46]"
            }`}
          >
            {m.won ? t("matchHistory.win") : t("matchHistory.loss")}
          </span>
        </div>
      ))}
    </div>
  );
}
