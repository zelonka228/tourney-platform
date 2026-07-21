import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams, getTournaments } from "../lib/api";
import { isFavorite, onFavoritesChanged } from "../lib/favorites";

const MAX_PER_SECTION = 5;

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" {...props}>
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Header trigger (icon + ⌘K hint) and the search overlay itself, bundled in
// one component — the global keydown listener that opens it has to live
// somewhere mounted for the whole app regardless of route, and splitting
// "the button" from "the thing the button opens" into two files would just
// mean threading `open`/`setOpen` between them for no benefit.
export function GlobalSearch() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState(null); // null = not fetched yet
  const [tournaments, setTournaments] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [favoritesTick, setFavoritesTick] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => onFavoritesChanged(() => setFavoritesTick((v) => v + 1)), []);

  // Ctrl/Cmd+K opens from anywhere; Escape closes. Registered once for the
  // whole app rather than per-page, so it works no matter what route is
  // showing — this is exactly why GlobalSearch mounts once at the App root.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetched lazily on first open, not on every app load — most sessions
  // never touch search at all.
  useEffect(() => {
    if (!open || teams !== null) return;
    getTeams().then(setTeams);
    getTournaments().then(setTournaments);
  }, [open, teams]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Let the enter animation start before stealing focus — autofocus
      // mid-transition on some browsers visibly jumps the panel.
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  // Shown as their own section only when idle (no query) — once someone's
  // actually searching, name matching already surfaces a favorited team
  // like any other and a second copy of it up top would just be clutter.
  // eslint-disable-next-line no-unused-vars
  const favoriteTeamResults = useMemo(() => {
    if (!teams || q) return [];
    return teams.filter((tm) => isFavorite(tm.id)).slice(0, MAX_PER_SECTION);
    // favoritesTick forces recompute when a favorite is toggled elsewhere
    // while this panel happens to be open — isFavorite() itself reads
    // localStorage fresh, it just needs a reason to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, q, favoritesTick]);
  const teamResults = useMemo(() => {
    if (!teams) return [];
    if (!q) {
      const favIds = new Set(favoriteTeamResults.map((tm) => tm.id));
      return teams.filter((tm) => !favIds.has(tm.id)).slice(0, MAX_PER_SECTION);
    }
    return teams.filter((tm) => tm.name.toLowerCase().includes(q)).slice(0, MAX_PER_SECTION);
  }, [teams, q, favoriteTeamResults]);
  const tournamentResults = useMemo(() => {
    if (!tournaments) return [];
    if (!q) return tournaments.slice(0, MAX_PER_SECTION);
    return tournaments.filter((tr) => tr.name.toLowerCase().includes(q)).slice(0, MAX_PER_SECTION);
  }, [tournaments, q]);

  // One flat list backs keyboard up/down/enter regardless of which section
  // a result visually sits in. Favorites lead, matching their position on
  // screen.
  const flatResults = useMemo(
    () => [
      ...favoriteTeamResults.map((tm) => ({ kind: "team", item: tm })),
      ...teamResults.map((tm) => ({ kind: "team", item: tm })),
      ...tournamentResults.map((tr) => ({ kind: "tournament", item: tr })),
    ],
    [favoriteTeamResults, teamResults, tournamentResults]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  function go(result) {
    if (!result) return;
    setOpen(false);
    nav(result.kind === "team" ? `/profile/${result.item.id}` : `/tournament/${result.item.id}`);
  }

  function onInputKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flatResults[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="search-trigger"
        aria-label={t("search.open")}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-[#a1a1aa] border border-[#27272a] rounded-sm hover:text-white hover:border-[#3f3f46] transition-colors"
      >
        <SearchIcon />
        <span className="hidden sm:inline text-[11px] font-mono text-[#52525b]">
          {navigator.platform?.toLowerCase().includes("mac") ? "⌘K" : "Ctrl+K"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="absolute inset-0 bg-void/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              data-testid="search-panel"
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-lg bg-surface border border-[#27272a] rounded-sm shadow-2xl overflow-hidden clip-corner"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center gap-3 px-4 border-b border-[#27272a]">
                <SearchIcon className="text-[#52525b] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  data-testid="search-input"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder={t("search.placeholder")}
                  className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder:text-[#52525b] focus:outline-none"
                />
                <span className="hidden sm:block text-[10px] font-mono text-[#52525b] shrink-0">
                  ESC
                </span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto py-2">
                {flatResults.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-[#52525b]">
                    {t("search.noResults")}
                  </p>
                )}

                {favoriteTeamResults.length > 0 && (
                  <SearchSection label={t("search.favorites")}>
                    {favoriteTeamResults.map((tm) => {
                      const flatIdx = flatResults.findIndex(
                        (r) => r.kind === "team" && r.item.id === tm.id
                      );
                      return (
                        <SearchRow
                          key={`fav-${tm.id}`}
                          active={flatIdx === activeIndex}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => go({ kind: "team", item: tm })}
                          title={tm.name}
                          subtitle={tm.discipline}
                          favorite
                        />
                      );
                    })}
                  </SearchSection>
                )}

                {teamResults.length > 0 && (
                  <SearchSection label={t("search.teams")}>
                    {teamResults.map((tm) => {
                      const flatIdx = flatResults.findIndex(
                        (r) => r.kind === "team" && r.item.id === tm.id
                      );
                      return (
                        <SearchRow
                          key={`team-${tm.id}`}
                          active={flatIdx === activeIndex}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => go({ kind: "team", item: tm })}
                          title={tm.name}
                          subtitle={tm.discipline}
                          favorite={isFavorite(tm.id)}
                        />
                      );
                    })}
                  </SearchSection>
                )}

                {tournamentResults.length > 0 && (
                  <SearchSection label={t("search.tournaments")}>
                    {tournamentResults.map((tr) => {
                      const flatIdx = flatResults.findIndex(
                        (r) => r.kind === "tournament" && r.item.id === tr.id
                      );
                      return (
                        <SearchRow
                          key={`tournament-${tr.id}`}
                          active={flatIdx === activeIndex}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => go({ kind: "tournament", item: tr })}
                          title={tr.name}
                          subtitle={`${tr.discipline} · BO${tr.matchFormat}`}
                        />
                      );
                    })}
                  </SearchSection>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SearchSection({ label, children }) {
  return (
    <div className="mb-1">
      <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[#52525b]">
        {label}
      </div>
      {children}
    </div>
  );
}

function SearchRow({ active, onMouseEnter, onClick, title, subtitle, favorite }) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        active ? "bg-cyan/10 text-white" : "text-[#a1a1aa] hover:bg-[#27272a]/50"
      }`}
    >
      <span className={`w-1.5 h-1.5 rotate-45 shrink-0 ${active ? "bg-cyan" : "bg-[#3f3f46]"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate">{title}</span>
        <span className="block text-[11px] font-mono text-[#52525b] truncate">{subtitle}</span>
      </span>
      {favorite && <span className="text-volt text-sm shrink-0">★</span>}
    </button>
  );
}
