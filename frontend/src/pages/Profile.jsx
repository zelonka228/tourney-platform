import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams, getPlayerStats } from "../lib/api";
import { downloadTeamCard } from "../lib/exportCard";
import { socket } from "../lib/socket";
import {
  avgRating,
  effectivePlayerRank,
  liveRankFromStats,
  liveNickFromStats,
  teamRarity,
  RARITY_TIERS,
  DISCIPLINES,
  DISCIPLINE_LIST,
  VALORANT_RANKS,
} from "../lib/demo";
import { Btn, Overline, Panel, Stat, Input, Select } from "../components/arena";
import { PlayerStatsWidget } from "../components/PlayerStatsWidget";
import { TeamCard } from "../components/TeamCard";
import { AnimatedNumber } from "../components/motion";
import { Skeleton } from "../components/Skeleton";
import { ScaleToFit } from "../components/ScaleToFit";
import { TeamMatchHistory } from "../components/TeamMatchHistory";
import { TeamAchievements } from "../components/TeamAchievements";
import { isFavorite, toggleFavorite, onFavoritesChanged } from "../lib/favorites";
import { isPackOpened, onPacksChanged } from "../lib/openedPacks";

// Ranks (Valorant) don't have a natural "count up" — but avgRating already
// resolves them to a numeric VALORANT_RANKS index under the hood, so the
// same AnimatedNumber component can tick through rank names instead of
// digits. Numeric disciplines (CS2/Dota) need no formatter at all.
const rankFormat = (v) => VALORANT_RANKS[Math.max(0, Math.min(Math.round(v), VALORANT_RANKS.length - 1))];

export function Profile() {
  const { t } = useI18n();
  const nav = useNavigate();
  // Team id lives in the URL (/profile/:id) so a detail view is a real,
  // shareable/back-button-able link, not just in-memory state — used by the
  // header search and the head-to-head comparison page to link straight to
  // a team. `sel` derives from it rather than duplicating it in state.
  const { id } = useParams();
  const sel = id ? Number(id) : null;
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
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
  const [cardSaving, setCardSaving] = useState(false);
  const cardRef = useRef(null);
  // Same silent-no-op the Collection gallery had: TeamCard only mounts the
  // node downloadTeamCard needs once its pack-opening animation reaches
  // "opened", so the download button did nothing for a still-closed pack.
  // `sel` (the raw :id param) doubles as the team id here without waiting
  // on `team` below, which isn't resolved until after the list/detail
  // branch — a hook can't live past that early return.
  const [cardOpened, setCardOpened] = useState(() => (sel !== null ? isPackOpened(sel) : false));
  useEffect(() => {
    setCardOpened(sel !== null ? isPackOpened(sel) : false);
    return onPacksChanged(() => setCardOpened(sel !== null ? isPackOpened(sel) : false));
  }, [sel]);
  // Favorites live in localStorage (lib/favorites.js), outside React state —
  // this tick just forces a re-render/re-sort when they change, since
  // isFavorite() itself is read fresh on every render rather than cached.
  const [favoritesTick, setFavoritesTick] = useState(0);

  useEffect(() => onFavoritesChanged(() => setFavoritesTick((v) => v + 1)), []);

  useEffect(() => {
    getTeams().then((data) => {
      setTeams(data);
      setLoading(false);
    });
    const onChanged = () => getTeams().then(setTeams);
    socket.on("teams:changed", onChanged);
    return () => socket.off("teams:changed", onChanged);
  }, []);

  // If the team currently open in detail view got deleted elsewhere (or by
  // the local admin panel, which hits the same API), fall back to the list
  // instead of rendering a stale/undefined team.
  useEffect(() => {
    if (sel !== null && teams.length > 0 && !teams.some((tm) => tm.id === sel)) {
      nav("/profile");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, teams]);

  async function downloadCard(teamName) {
    setCardSaving(true);
    try {
      await downloadTeamCard(cardRef.current, teamName);
    } finally {
      setCardSaving(false);
    }
  }

  if (sel === null) {
    return (
      <div className="py-10" data-testid="profile-list">
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
          {t("profile.title")}
        </h1>
        <p className="text-[#a1a1aa] mt-2">{t("profile.sub")}</p>
        <div className="flex flex-wrap gap-3 mt-4">
          {teams.length > 5 && (
            <Input
              value={query}
              data-testid="profile-search"
              placeholder={t("hall.search")}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-sm"
            />
          )}
          <Select
            value={disciplineFilter}
            data-testid="profile-discipline-filter"
            onChange={(e) => setDisciplineFilter(e.target.value)}
            className="max-w-[200px]"
          >
            <option value="all">{t("hall.all")}</option>
            {DISCIPLINE_LIST.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {loading &&
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="p-5 flex items-center gap-4 border border-[#27272a] clip-corner">
                <Skeleton className="w-12 h-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </div>
              </div>
            ))}
          {!loading &&
            // favoritesTick isn't read here — it's just what makes this
            // render re-run when favorites change elsewhere, since
            // isFavorite() below reads localStorage fresh every call rather
            // than caching in React state.
            favoritesTick >= 0 &&
            teams
              .map((team, i) => ({ team, i }))
              .filter(({ team }) => team.name.toLowerCase().includes(query.trim().toLowerCase()))
              .filter(({ team }) => disciplineFilter === "all" || team.discipline === disciplineFilter)
              // Favorites first — Array.sort is stable, so ties (both or
              // neither favorited) keep the original relative order.
              .sort((a, b) => isFavorite(b.team.id) - isFavorite(a.team.id))
              .map(({ team, i }) => {
              // Рейтинг — середнє лише основного складу, підстави не враховуються.
              // Для CS2-гравців з прив'язаним FACEIT — живий ELO замість
              // застарілого вручну введеного значення (з кешу останнього фетчу).
              const r = avgRating(
                team.discipline,
                team.players
                  .filter((p) => !p.isSubstitute)
                  .map((p) => effectivePlayerRank(team.discipline, p))
              );
              // A plain button (not `role="button"` on this outer element)
              // can't contain the star's own real <button> without nesting
              // interactive controls — invalid HTML, and it showed up in
              // the accessibility tree as a button-inside-a-button. Div +
              // role/tabIndex/onKeyDown reproduces button semantics for the
              // "click anywhere on the card" behavior while leaving the
              // star free to be a normal, independently-focusable button.
              return (
                <motion.div
                  key={team.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`team-card-${i}`}
                  onClick={() => nav(`/profile/${team.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      nav(`/profile/${team.id}`);
                    }
                  }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="text-left cursor-pointer"
                >
                  <Panel
                    clip
                    className="relative p-5 flex items-center gap-4 hover:border-cyan transition-colors"
                  >
                    <FavoriteStar teamId={team.id} />
                    <Logo logo={team.logo} className="w-12 h-12" />
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-white truncate">{team.name}</h3>
                      <p className="text-xs font-mono text-[#a1a1aa] mt-1">
                        {team.discipline} · {r.label} {t(`unit.${r.unitKey}`)}
                      </p>
                    </div>
                  </Panel>
                </motion.div>
              );
            })}
        </div>
      </div>
    );
  }

  const team = teams.find((tm) => tm.id === sel);
  if (!team) return null; // brief frame while the reset effect above fires
  const mainPlayers = team.players.filter((p) => !p.isSubstitute);
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);
  const rankFor = (p) => liveElo[p.id] ?? effectivePlayerRank(team.discipline, p);
  const rating = avgRating(team.discipline, mainPlayers.map(rankFor));
  const rarity = teamRarity(team);
  const isRankKind = DISCIPLINES[team.discipline].kind === "rank";

  return (
    <div className="py-10" data-testid="profile-detail">
      <div className="flex items-center justify-between">
        <Btn
          size="sm"
          variant="ghost"
          data-testid="profile-back-btn"
          onClick={() => nav("/profile")}
        >
          {t("profile.back")}
        </Btn>
        <div className="flex items-center gap-4">
          <Link
            to={`/compare?a=${team.id}`}
            className="text-cyan text-sm font-mono hover:underline"
          >
            {t("compare.title")}
          </Link>
          <Link to={`/team/${team.id}`} className="text-cyan text-sm font-mono hover:underline">
            {t("profile.edit")}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
          {team.name}
        </h1>
        <FavoriteStar teamId={team.id} size="lg" />
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 mt-8 items-start">
        <Panel clip className="min-w-0">
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
            <Overline>
              {t("profile.roster")} · {unit}
            </Overline>
            <div className="mt-3 divide-y divide-[#27272a]/60">
              {mainPlayers.map((p, i) => (
                <PlayerRow
                  key={p.id ?? `${p.nick}-${i}`}
                  p={p}
                  discipline={team.discipline}
                  onLiveElo={(elo) => setLiveElo((prev) => ({ ...prev, [p.id]: elo }))}
                />
              ))}
            </div>
            {team.players.some((p) => p.isSubstitute) && (
              <>
                <Overline className="mt-4">{t("profile.subs")}</Overline>
                <div className="mt-3 divide-y divide-[#27272a]/60">
                  {team.players
                    .filter((p) => p.isSubstitute)
                    .map((p, i) => (
                      <PlayerRow
                        key={p.id ?? `sub-${p.nick}-${i}`}
                        p={p}
                        discipline={team.discipline}
                      />
                    ))}
                </div>
              </>
            )}
          </div>
        </Panel>

        <div className="space-y-4 min-w-0">
          <Panel clip className="p-6">
            <Overline>{t("profile.rating")}</Overline>
            <div className="font-mono text-5xl text-cyan mt-4">
              <AnimatedNumber
                value={rating.value ?? rating.label}
                format={isRankKind ? rankFormat : undefined}
                immediate
              />
            </div>
            <div className="overline mt-1">
              {unit} · {mainPlayers.length} {t("profile.players")}
            </div>
            <p className="text-[#a1a1aa] text-sm mt-4">{t("profile.ratingDesc")}</p>
          </Panel>
          <Panel clip className="p-6">
            <Overline>{t("profile.rarity")}</Overline>
            <div className="flex gap-2 mt-4">
              {RARITY_TIERS.map((tier) => (
                <span
                  key={tier}
                  className={`px-3 py-1 text-xs font-mono border rounded-sm ${
                    tier === rarity
                      ? "border-volt text-volt bg-volt/10"
                      : "border-[#27272a] text-[#52525b]"
                  }`}
                >
                  {tier}
                </span>
              ))}
            </div>
          </Panel>
          <Panel clip className="p-6" data-testid="team-achievements-panel">
            <Overline>{t("achievements.title")}</Overline>
            <div className="mt-4">
              <TeamAchievements
                team={team}
                teamsById={Object.fromEntries(teams.map((tm) => [tm.id, tm]))}
              />
            </div>
          </Panel>
          <Panel clip className="p-6" data-testid="team-match-history-panel">
            <Overline>{t("matchHistory.title")}</Overline>
            <div className="mt-3">
              <TeamMatchHistory
                teamId={team.id}
                teamsById={Object.fromEntries(teams.map((tm) => [tm.id, tm]))}
              />
            </div>
          </Panel>
          <Panel
            clip
            className="p-6 flex flex-col items-center gap-4 min-w-0 w-full"
            data-testid="team-card-panel"
          >
            <Overline className="self-start">{t("profile.card.open")}</Overline>
            <ScaleToFit width={320}>
              <TeamCard ref={cardRef} team={team} />
            </ScaleToFit>
            {cardOpened && (
              <Btn
                variant="primary"
                data-testid="team-card-download"
                disabled={cardSaving}
                onClick={() => downloadCard(team.name)}
              >
                {cardSaving ? "…" : t("profile.card.download")}
              </Btn>
            )}
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
  const displayNick = (data && liveNickFromStats(discipline, data)) ?? p.nick;

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
          <Link
            to={`/player/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`text-sm truncate block hover:underline hover:text-cyan ${clickable ? "text-white group-hover:text-cyan transition-colors" : "text-white"}`}
          >
            {displayNick}
          </Link>
          <div className="text-[11px] font-mono text-[#a1a1aa]">{p.role}</div>
        </div>
        <span className="ml-auto font-mono text-sm text-cyan">{displayRank}</span>
        {clickable && (
          <span
            className={`text-[#52525b] text-xs transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
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

// Small = absolutely positioned corner badge for the team-list card grid
// (whole card is a button that navigates, so this stops propagation and
// sits on top via its own z-index). Large = inline next to the H1 on the
// detail view. Same toggle logic either way, just different placement.
function FavoriteStar({ teamId, size = "sm" }) {
  const { t } = useI18n();
  const [fav, setFav] = useState(() => isFavorite(teamId));

  useEffect(() => setFav(isFavorite(teamId)), [teamId]);

  function handleClick(e) {
    e.stopPropagation();
    e.preventDefault();
    setFav(toggleFavorite(teamId));
  }

  const label = t(fav ? "profile.unfavorite" : "profile.favorite");

  if (size === "lg") {
    return (
      <button
        type="button"
        onClick={handleClick}
        data-testid="favorite-star-detail"
        aria-label={label}
        aria-pressed={fav}
        title={label}
        className={`text-3xl leading-none transition-transform hover:scale-110 ${
          fav ? "text-volt" : "text-[#3f3f46] hover:text-[#71717a]"
        }`}
      >
        ★
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="favorite-star"
      aria-label={label}
      aria-pressed={fav}
      title={label}
      className={`absolute top-2 right-2 z-10 w-7 h-7 grid place-items-center rounded-sm text-lg leading-none transition-colors ${
        fav ? "text-volt" : "text-[#3f3f46] hover:text-[#71717a]"
      }`}
    >
      ★
    </button>
  );
}

function Logo({ logo, className }) {
  return (
    <div
      className={`shrink-0 border border-[#27272a] bg-void grid place-items-center overflow-hidden ${className}`}
    >
      {logo ? (
        <img src={logo} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="w-3 h-3 border border-cyan/40 rotate-45" />
      )}
    </div>
  );
}
