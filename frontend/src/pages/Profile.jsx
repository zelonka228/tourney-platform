import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams, getPlayerStats } from "../lib/api";
import { avgRating, effectivePlayerRank, liveRankFromStats, DISCIPLINES } from "../lib/demo";
import { Btn, Overline, Panel, Stat } from "../components/arena";
import { PlayerStatsWidget } from "../components/PlayerStatsWidget";
import { Reveal } from "../components/motion";

export function Profile() {
  const { t } = useI18n();
  const [sel, setSel] = useState(null);
  const [teams, setTeams] = useState([]);
  // PlayerRow eager-fetches live stats for any linked player on mount (not
  // just on click, see PlayerRow) so the roster row shows the real rank
  // right away instead of a stale manually-entered one. Once fresh stats
  // come back they're reported up here via onLiveElo (already converted to
  // our internal unit by liveRankFromStats) so the team average updates to
  // the freshest value too, not only the DB-cached one from the last time
  // someone opened that player's widget. Declared here (not after the
  // list/detail branch below) — conditionally calling useState only on the
  // detail render broke the Rules of Hooks and crashed the whole page on
  // switching from the team list to a team's detail view.
  const [liveElo, setLiveElo] = useState({});

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  if (sel === null) {
    return (
      <div className="py-10" data-testid="profile-list">
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
          {t("profile.title")}
        </h1>
        <p className="text-[#a1a1aa] mt-2">{t("profile.sub")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {teams.map((team, i) => {
            // Рейтинг — середнє лише основного складу, підстави не враховуються.
            // Для CS2-гравців з прив'язаним FACEIT — живий ELO замість
            // застарілого вручну введеного значення (з кешу останнього фетчу).
            const r = avgRating(
              team.discipline,
              team.players.filter((p) => !p.isSubstitute).map((p) => effectivePlayerRank(team.discipline, p))
            );
            return (
              <motion.button
                key={team.id}
                data-testid={`team-card-${i}`}
                onClick={() => setSel(i)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="text-left"
              >
                <Panel clip className="p-5 flex items-center gap-4 hover:border-cyan transition-colors">
                  <Logo logo={team.logo} className="w-12 h-12" />
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-white truncate">{team.name}</h3>
                    <p className="text-xs font-mono text-[#a1a1aa] mt-1">
                      {team.discipline} · {r.label} {t(`unit.${r.unitKey}`)}
                    </p>
                  </div>
                </Panel>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  const team = teams[sel];
  const mainPlayers = team.players.filter((p) => !p.isSubstitute);
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);
  const rankFor = (p) => liveElo[p.id] ?? effectivePlayerRank(team.discipline, p);
  const rating = avgRating(team.discipline, mainPlayers.map(rankFor));

  return (
    <div className="py-10" data-testid="profile-detail">
      <div className="flex items-center justify-between">
        <Btn size="sm" variant="ghost" data-testid="profile-back-btn" onClick={() => setSel(null)}>
          {t("profile.back")}
        </Btn>
        <Link to={`/team/${team.id}`} className="text-cyan text-sm font-mono hover:underline">
          {t("profile.edit")}
        </Link>
      </div>

      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-6">
        {team.name}
      </h1>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 mt-8 items-start">
        <Panel clip>
          <div className="flex items-center gap-4 p-5 border-b border-[#27272a]">
            <Logo logo={team.logo} className="w-14 h-14" />
            <div>
              <div className="font-display font-bold text-lg text-white">{team.name}</div>
              <div className="text-xs font-mono text-[#a1a1aa] mt-1">
                {team.discipline} · {unit}: <span className="text-cyan">{rating.label}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#27272a]">
            <Stat value={team.winrate ?? "—"} label={t("profile.winrate")} />
            <Stat value={team.streak ?? "—"} label={t("profile.streak")} accent="volt" />
            <Stat value={team.tournaments} label={t("profile.tournaments")} />
            <Stat value={team.best ?? "—"} label={t("profile.best")} accent="volt" />
          </div>
          <div className="p-5">
            <Overline>{t("profile.roster")} · {unit}</Overline>
            <div className="mt-3 divide-y divide-[#27272a]/60">
              {mainPlayers.map((p, i) => (
                <Reveal key={p.id ?? `${p.nick}-${i}`} index={i} y={10}>
                  <PlayerRow
                    p={p}
                    discipline={team.discipline}
                    onLiveElo={(elo) => setLiveElo((prev) => ({ ...prev, [p.id]: elo }))}
                  />
                </Reveal>
              ))}
            </div>
            {team.players.some((p) => p.isSubstitute) && (
              <>
                <Overline className="mt-4">{t("profile.subs")}</Overline>
                <div className="mt-3 divide-y divide-[#27272a]/60">
                  {team.players
                    .filter((p) => p.isSubstitute)
                    .map((p, i) => (
                      <PlayerRow key={p.id ?? `sub-${p.nick}-${i}`} p={p} discipline={team.discipline} />
                    ))}
                </div>
              </>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel clip className="p-6">
            <Overline>{t("profile.rating")}</Overline>
            <div className="font-mono text-5xl text-cyan mt-4">{rating.label}</div>
            <div className="overline mt-1">{unit} · {mainPlayers.length} {t("profile.players")}</div>
            <p className="text-[#a1a1aa] text-sm mt-4">{t("profile.ratingDesc")}</p>
          </Panel>
          <Panel clip className="p-6">
            <Overline>{t("profile.rarity")}</Overline>
            <div className="flex gap-2 mt-4">
              {["Common", "Rare", "Epic", "Legendary"].map((tier, i) => (
                <span
                  key={tier}
                  className={`px-3 py-1 text-xs font-mono border rounded-sm ${
                    i === 2 ? "border-volt text-volt bg-volt/10" : "border-[#27272a] text-[#52525b]"
                  }`}
                >
                  {tier}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// Clicking a player with a linked external profile expands a "mini profile"
// widget below the row (FACEIT/tracker.gg-style). The fetch also happens
// eagerly on mount (not just on click) for every linked player, not only
// CS2 — the displayed rank next to the name is the live one (FACEIT ELO /
// HenrikDev tier), not the manually-entered rank, and it needs to be
// correct even before anyone expands the widget (a Valorant row showing a
// stale "Diamond" until clicked, when the account is actually Radiant, was
// confusing). See liveRankFromStats in lib/demo.js, which converts each
// discipline's raw payload into our internal unit, or returns null when it
// can't (e.g. Valorant "Unrated" has no mapping — the manually-entered rank
// stays authoritative in that case, and the eager fetch here doesn't change
// that).
function PlayerRow({ p, discipline, onLiveElo }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const clickable = Boolean(p.externalRef);

  function load(refresh = false) {
    setStatus("loading");
    setError(null);
    getPlayerStats(p.id, { refresh })
      .then((res) => {
        setData(res);
        setStatus("ready");
        const live = liveRankFromStats(discipline, res);
        if (live != null) onLiveElo?.(live);
      })
      .catch((err) => {
        setError(err.message ?? String(err));
        setStatus("error");
      });
  }

  useEffect(() => {
    if (clickable && status === "idle") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (!clickable) return;
    const next = !open;
    setOpen(next);
    if (next && status === "idle") load();
  }

  const displayRank = (data && liveRankFromStats(discipline, data)) ?? p.rank;

  return (
    <div className="py-2.5">
      <div
        role={clickable ? "button" : undefined}
        onClick={toggle}
        data-testid={`player-row-${p.id}`}
        className={`flex items-center gap-3 ${clickable ? "cursor-pointer group" : ""}`}
      >
        <span
          className={`w-1.5 h-1.5 rotate-45 shrink-0 ${clickable ? "bg-cyan group-hover:shadow-[0_0_6px_#00f0ff]" : "bg-cyan/60"}`}
        />
        <div className="min-w-0">
          <div className={`text-sm truncate ${clickable ? "text-white group-hover:text-cyan transition-colors" : "text-white"}`}>
            {p.nick}
          </div>
          <div className="text-[11px] font-mono text-[#a1a1aa]">{p.role}</div>
        </div>
        <span className="ml-auto font-mono text-sm text-cyan">{displayRank}</span>
        {clickable && (
          <span className={`text-[#52525b] text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        )}
      </div>
      {open && (
        <PlayerStatsWidget
          status={status === "ready" ? "ready" : status}
          data={data}
          error={error}
          onRetry={() => load()}
        />
      )}
    </div>
  );
}

function Logo({ logo, className }) {
  return (
    <div className={`shrink-0 border border-[#27272a] bg-void grid place-items-center overflow-hidden ${className}`}>
      {logo ? (
        <img src={logo} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="w-3 h-3 border border-cyan/40 rotate-45" />
      )}
    </div>
  );
}
