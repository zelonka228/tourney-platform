import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { getTeams, getPlayerStats } from "../lib/api";
import {
  DISCIPLINES,
  effectivePlayerRank,
  effectivePlayerNick,
  liveRankFromStats,
  liveNickFromStats,
} from "../lib/demo";
import { Btn, Overline, Panel } from "../components/arena";
import { PlayerStatsWidget } from "../components/PlayerStatsWidget";

// Гравець не окрема сутність у роутінгу бекенду (Player завжди належить
// команді, немає GET /api/players/:id без /stats) — тому цю сторінку
// будуємо з уже наявних даних getTeams() (той самий виклик, що й /profile
// та /hall), шукаючи гравця по всіх командах за id. Жодного нового
// бекенд-ендпоінту не потрібно.
export function Player() {
  const { id } = useParams();
  const { t } = useI18n();
  const [teams, setTeams] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [statsData, setStatsData] = useState(null);
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  const playerId = Number(id);
  const match = teams
    ?.flatMap((team) => team.players.map((p) => ({ team, player: p })))
    .find(({ player }) => player.id === playerId);

  function load(refresh = false) {
    if (!match) return;
    setStatus("loading");
    setStatsError(null);
    getPlayerStats(match.player.id, { refresh })
      .then((res) => {
        setStatsData(res);
        setStatus("ready");
      })
      .catch((err) => {
        setStatsError(err.message ?? String(err));
        setStatus("error");
      });
  }

  useEffect(() => {
    if (match?.player.externalRef && status === "idle") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.player.id]);

  if (teams === null) return null; // короткий кадр першого фетчу, той самий підхід, що й у Profile.jsx

  if (!match) {
    return (
      <div className="py-10" data-testid="player-not-found">
        <p className="text-[#a1a1aa]">{t("player.notFound")}</p>
        <Link to="/profile" className="text-cyan text-sm font-mono hover:underline mt-2 inline-block">
          {t("profile.back")}
        </Link>
      </div>
    );
  }

  const { team, player } = match;
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);
  const displayNick = (statsData && liveNickFromStats(team.discipline, statsData)) ?? effectivePlayerNick(team.discipline, player);
  const displayRank = (statsData && liveRankFromStats(team.discipline, statsData)) ?? effectivePlayerRank(team.discipline, player);

  return (
    <div className="py-10" data-testid="player-page">
      <Link to={`/team/${team.id}`} className="text-cyan text-sm font-mono hover:underline">
        ← {team.name}
      </Link>

      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-4">
        {displayNick}
      </h1>
      <p className="text-[#a1a1aa] mt-2">
        {player.role} · {team.discipline}
      </p>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 mt-8 items-start">
        <Panel clip className="p-5">
          <Overline>{t("player.rank")}</Overline>
          <div className="font-mono text-3xl text-cyan mt-2">{displayRank}</div>
          <div className="text-xs font-mono text-[#71717a] mt-1">{unit}</div>
          {player.isSubstitute && (
            <div className="text-xs font-mono text-volt mt-3">{t("player.substitute")}</div>
          )}
          {statsData?.profileUrl && (
            <a
              href={statsData.profileUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="player-external-link"
              className="mt-4 inline-block text-xs font-mono text-cyan hover:underline"
            >
              {t(`widget.viewProfile.${statsData.provider}`)} →
            </a>
          )}
        </Panel>

        {player.externalRef && (
          <PlayerStatsWidget
            status={status}
            data={statsData}
            error={statsError}
            onRetry={() => load(true)}
          />
        )}
      </div>
    </div>
  );
}
