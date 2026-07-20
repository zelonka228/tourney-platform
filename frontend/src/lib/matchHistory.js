import { useEffect, useState } from "react";
import { getTournaments, getTournament } from "./api";

// Немає окремого бекенд-ендпоінту "матчі команди X" (Match зберігає лише
// teamAId/teamBId, без зв'язку назад до команди) — тому будуємо історію на
// фронтенді з уже наявних викликів: GET /api/tournaments (список із
// вкладеними TournamentTeam, щоб відсіяти турніри, де команда взагалі
// грала) + GET /api/tournaments/:id (повні матчі) лише для тих турнірів.
// Кількість турнірів у цьому застосунку невелика (навчальний проєкт), тож
// N+1 запитів тут прийнятні — окремий бекенд-роут був би "правильнішим",
// але зайвим для цього масштабу.
//
// Винесено з TeamMatchHistory в окремий хук, щоб TeamAchievements міг
// використати ті самі рядки матчів без повторного набору запитів.
export function useTeamMatches(teamId, teamsById) {
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

  return matches;
}
