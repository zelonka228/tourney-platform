import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion } from "framer-motion";
import { io } from "socket.io-client";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import {
  getTournament, getTournaments, submitMatchScore, generateBracket, deleteTournament, reorderTournamentTeams,
} from "../lib/api";
import { validScorelines } from "../lib/demo";
import { Btn, Overline, Panel } from "../components/arena";
import { Reveal } from "../components/motion";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function useRoundLabel() {
  const { t } = useI18n();
  return (cnt) => {
    if (cnt === 1) return t("round.final");
    if (cnt === 2) return t("round.semi");
    if (cnt === 4) return t("round.quarter");
    if (cnt === 8) return t("round.eighth");
    return t("round.of", { n: cnt });
  };
}

function MatchCard({ m, teamName, openEdit, cardRef, enterScoreLabel, byeLabel, isAdmin }) {
  const a = teamName(m.teamAId);
  const b = teamName(m.teamBId);
  const isBye = m.status === "bye";
  const decided = m.status === "done" || isBye;
  const winnerId = isBye
    ? (m.teamAId ?? m.teamBId)
    : m.status === "done" ? (m.scoreA > m.scoreB ? m.teamAId : m.teamBId) : null;
  const todo = a && b && m.status === "pending";
  const clickable = isAdmin && todo;
  const pending = (!a || !b) && !isBye;

  return (
    // The ref used for wire geometry (cardRef) sits on a plain, un-animated
    // div. It used to be on the motion.div directly — but getBoundingClientRect
    // includes CSS transforms, and the "pop" below animates `scale` on mount.
    // The connector-recompute effect fires in the same commit as the status
    // change, i.e. exactly when this card is still at its `initial` transform
    // (scale 0.92) — so the wire would permanently lock onto that shrunk,
    // off-center rect instead of the settled 220px box once the animation
    // finished. Moving the animation to an inner wrapper keeps the outer
    // box's layout rect constant throughout, so the wire never drifts.
    <div
      ref={cardRef}
      onClick={clickable ? () => openEdit(m) : undefined}
      className={`w-[220px] bg-surface border rounded-sm overflow-hidden transition-colors ${
        todo ? `border-cyan shadow-[0_0_0_1px_#00f0ff] ${clickable ? "cursor-pointer" : ""}` : "border-[#27272a]"
      } ${pending ? "opacity-45" : ""}`}
      data-testid={`match-card-${m.id}`}
    >
      <motion.div
        initial={decided ? { scale: 0.92, opacity: 0.5 } : { opacity: 0, x: -16 }}
        animate={decided
          ? { scale: [0.92, 1.03, 1], opacity: 1, boxShadow: ["0 0 0 rgba(0,240,255,0)", "0 0 22px rgba(0,240,255,0.5)", "0 0 0 rgba(0,240,255,0)"] }
          : { opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {[
          { id: m.teamAId, name: a, score: m.scoreA },
          { id: m.teamBId, name: b, score: m.scoreB },
        ].map((side, i) => {
          const win = decided && winnerId === side.id;
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2.5 text-sm ${i === 1 ? "border-t border-[#27272a]" : ""} ${
                win ? "text-white border-l-2 border-l-cyan bg-cyan/5" : "text-[#a1a1aa]"
              }`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={side.name ?? "empty"}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className={`truncate ${win ? "font-semibold" : ""} ${!side.name && isBye ? "italic text-[#52525b]" : ""}`}
                >
                  {side.name ?? "—"}
                </motion.span>
              </AnimatePresence>
              <span className={`font-mono ml-2 ${win ? "text-cyan" : "text-[#52525b]"}`}>
                {m.status === "done" ? side.score : ""}
              </span>
            </div>
          );
        })}
        {todo && <div className="text-center py-1 bg-cyan text-void text-[10px] font-mono uppercase tracking-widest">{enterScoreLabel}</div>}
        {isBye && <div className="text-center py-1 bg-[#3f3f46] text-[#d4d4d8] text-[10px] font-mono uppercase tracking-widest">{byeLabel}</div>}
      </motion.div>
    </div>
  );
}

function TournamentPicker() {
  const { t } = useI18n();
  const [list, setList] = useState(null);
  useEffect(() => { getTournaments().then(setList); }, []);
  return (
    <div className="py-10" data-testid="tournament-picker">
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">{t("tour.title")}</h1>
      {list === null && <p className="text-[#a1a1aa] mt-4">{t("tour.loading")}</p>}
      {list?.length === 0 && (
        <p className="text-[#a1a1aa] mt-4">
          {t("tour.none")} <Link to="/create" className="text-cyan hover:underline">{t("tour.createLink")}</Link>
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {list?.map((tm) => (
          <Link key={tm.id} to={`/tournament/${tm.id}`} data-testid={`tournament-link-${tm.id}`}>
            <Panel clip className="p-5 hover:border-cyan transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-white">{tm.name}</h3>
                <span className="text-cyan">→</span>
              </div>
              <p className="text-xs font-mono text-[#a1a1aa] mt-2">
                {tm.discipline} · BO{tm.matchFormat} · {tm.status}
              </p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Tournament() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const roundLabel = useRoundLabel();
  const [tournament, setTournament] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("grid");
  const [edit, setEdit] = useState(null);
  const [scoreError, setScoreError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState(null);

  const bracketRef = useRef(null);
  const svgRef = useRef(null);
  const pulseSvgRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const connectorsRef = useRef([]);
  const activePulses = useRef(new Set());
  const decidedIdsRef = useRef(new Set());
  const [connectors, setConnectors] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const setNodeRef = (key) => (el) => { if (el) nodeRefs.current.set(key, el); else nodeRefs.current.delete(key); };

  useEffect(() => {
    if (!id) return;
    setTournament(null); setNotFound(false);
    getTournament(id).then((tm) => {
      if (!tm) { setNotFound(true); return; }
      setTournament(tm);
      // Land straight on "Команди" when there's manual-seeding work to do
      // (teams registered, no bracket yet) — the "Сітка" tab in that state
      // has nothing but a "not generated" message, and the actual reorder
      // controls live on the teams tab, easy to miss otherwise.
      if (tm.matches.length === 0 && tm.teams.length > 0) setTab("teams");
    });
  }, [id]);

  function mergeMatches(...updated) {
    const newlyDecided = [];
    for (const m of updated) {
      if (!m) continue;
      const dec = m.status === "done" || m.status === "bye";
      if (dec && !decidedIdsRef.current.has(m.id)) { decidedIdsRef.current.add(m.id); newlyDecided.push(m.id); }
    }
    setTournament((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.matches.map((m) => [m.id, m]));
      for (const m of updated) if (m) byId.set(m.id, m);
      return { ...prev, matches: [...byId.values()] };
    });
    newlyDecided.forEach(fireConnectorPulse);
  }

  // Live-оновлення: приєднуємось до кімнати турніру, мерджимо чужі результати
  // матчів у локальний стан без перезавантаження сторінки (перевірено: дві
  // вкладки, live-sync без reload).
  useEffect(() => {
    if (!id) return;
    const socket = io(SOCKET_URL);
    socket.emit("tournament:join", id);
    socket.on("match:updated", (payload) => {
      if (String(payload.tournamentId) !== String(id)) return;
      mergeMatches(payload.match, payload.advanced);
    });
    return () => {
      socket.emit("tournament:leave", id);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fire a glowing dot that travels EXACTLY along the rendered wire.
  // We MEASURE from the real (DOM-attached) wire <path> so getPointAtLength is
  // reliable, but we APPEND the moving <circle> into a SEPARATE overlay <svg>
  // (pulseSvgRef) that React never touches — both svgs share the identical
  // coordinate space, so the dot lines up perfectly with the wire while
  // avoiding React reconciliation errors from mutating managed DOM.
  function fireConnectorPulse(matchId) {
    const wireSvg = svgRef.current;
    const overlay = pulseSvgRef.current;
    if (!wireSvg || !overlay) return;
    const pathEl = wireSvg.querySelector(`path[data-src="${CSS.escape(String(matchId))}"]`);
    if (!pathEl) return;
    const length = pathEl.getTotalLength();
    if (!length) return;
    const svgNS = "http://www.w3.org/2000/svg";
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("r", "4.5");
    dot.setAttribute("fill", "#00F0FF");
    dot.setAttribute("class", "flow-pulse-dot");
    dot.style.filter = "drop-shadow(0 0 6px #00F0FF) drop-shadow(0 0 12px rgba(0,240,255,0.6))";
    dot.style.opacity = "0";
    overlay.appendChild(dot);
    const controls = animate(0, 1, {
      duration: 0.9,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (p) => {
        const pt = pathEl.getPointAtLength(length * p);
        const fade = p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1;
        dot.setAttribute("cx", pt.x);
        dot.setAttribute("cy", pt.y);
        dot.style.opacity = String(fade);
      },
      onComplete: () => {
        const end = pathEl.getPointAtLength(length);
        fireImpactRing(overlay, end.x, end.y);
        dot.remove();
        activePulses.current.delete(controls);
      },
    });
    activePulses.current.add(controls);
  }

  // A quick expanding-and-fading ring where the pulse dot lands — a small
  // "arrival" pop so advancing to the next round reads as an event, not
  // just the dot quietly vanishing at the match card's edge.
  function fireImpactRing(overlay, x, y) {
    const svgNS = "http://www.w3.org/2000/svg";
    const ring = document.createElementNS(svgNS, "circle");
    ring.setAttribute("cx", x);
    ring.setAttribute("cy", y);
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#00F0FF");
    ring.setAttribute("stroke-width", "2");
    overlay.appendChild(ring);
    const controls = animate(0, 1, {
      duration: 0.5,
      ease: [0.2, 0.65, 0.4, 1],
      onUpdate: (p) => {
        ring.setAttribute("r", String(3 + p * 14));
        ring.style.opacity = String(1 - p);
      },
      onComplete: () => { ring.remove(); activePulses.current.delete(controls); },
    });
    activePulses.current.add(controls);
  }

  useEffect(() => () => {
    activePulses.current.forEach((c) => c.stop());
    activePulses.current.clear();
    pulseSvgRef.current?.querySelectorAll(".flow-pulse-dot").forEach((d) => d.remove());
  }, []);

  const teamName = (teamId) => tournament?.teams.find((tt) => tt.teamId === teamId)?.team?.name ?? null;
  const matches = tournament?.matches ?? [];
  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) + 1 : 0;
  const bo = tournament?.matchFormat ?? 3;
  const finalMatch = matches.find((m) => m.round === totalRounds - 1);

  const champion = useMemo(() => {
    if (!finalMatch) return null;
    if (finalMatch.status === "bye") return teamName(finalMatch.teamAId ?? finalMatch.teamBId);
    if (finalMatch.status === "done")
      return teamName(finalMatch.scoreA > finalMatch.scoreB ? finalMatch.teamAId : finalMatch.teamBId);
    return null;
  }, [finalMatch, tournament]);

  const results = useMemo(() => matches
    .filter((m) => m.status === "done" || m.status === "bye")
    .map((m) => {
      const cnt = matches.filter((x) => x.round === m.round).length;
      const winnerId = m.status === "bye" ? (m.teamAId ?? m.teamBId) : m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
      return { round: roundLabel(cnt), a: teamName(m.teamAId), b: teamName(m.teamBId), bye: m.status === "bye", sa: m.scoreA, sb: m.scoreB, w: teamName(winnerId) };
    }),
    [matches, tournament]);

  useLayoutEffect(() => {
    const container = bracketRef.current;
    if (!container || matches.length === 0) return;
    function recompute() {
      const cRect = container.getBoundingClientRect();
      const next = [];
      for (const m of matches) {
        let destKey;
        const destMatch = matches.find((x) => x.round === m.round + 1 && x.position === Math.floor(m.position / 2));
        if (destMatch) destKey = `m-${destMatch.id}`;
        else if (m.round === totalRounds - 1) destKey = "champion";
        else continue;
        const a = nodeRefs.current.get(`m-${m.id}`);
        const b = nodeRefs.current.get(destKey);
        if (!a || !b) continue;
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        const x1 = ar.right - cRect.left + container.scrollLeft;
        const y1 = ar.top + ar.height / 2 - cRect.top + container.scrollTop;
        const x2 = br.left - cRect.left + container.scrollLeft;
        const y2 = br.top + br.height / 2 - cRect.top + container.scrollTop;
        const midX = (x1 + x2) / 2;
        next.push({ key: `${m.id}-${destKey}`, sourceId: m.id, d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`, live: m.status === "done" || m.status === "bye" });
      }
      connectorsRef.current = next;
      setConnectors(next);
      setSvgSize({ w: container.scrollWidth, h: container.scrollHeight });
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    window.addEventListener("resize", recompute);
    return () => { ro.disconnect(); window.removeEventListener("resize", recompute); };
  }, [matches, totalRounds]);

  function openEdit(m) {
    if (isAdmin && m.teamAId && m.teamBId && m.status === "pending") {
      setEdit({ matchId: m.id, a: teamName(m.teamAId), b: teamName(m.teamBId) });
      setScoreError(null);
    }
  }
  async function saveScore(sa, sb) {
    try { const res = await submitMatchScore(edit.matchId, sa, sb); mergeMatches(res.match, res.advanced); setEdit(null); }
    catch (e) { setScoreError(e.message); }
  }
  async function handleDelete() {
    if (!window.confirm(t("tour.confirmDelete", { name: tournament.name }))) return;
    setDeleteError(null);
    try { await deleteTournament(id); nav("/tournament"); }
    catch (e) { setDeleteError(e.message); }
  }
  async function handleGenerate() {
    setGenerating(true);
    try { setTournament(await generateBracket(id)); } catch (e) { setScoreError(e.message); } finally { setGenerating(false); }
  }

  // Manual seeding: swap a team with its neighbor and persist the full
  // resulting order — reorder is only meaningful before the bracket exists
  // (the backend rejects it 409 once matches are generated, see teams tab).
  async function moveTeam(teamId, dir) {
    const ordered = tournament.teams.slice().sort((a, b) => a.seed - b.seed).map((tt) => tt.teamId);
    const i = ordered.indexOf(teamId);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    setReordering(true);
    setReorderError(null);
    try { setTournament(await reorderTournamentTeams(id, ordered)); }
    catch (e) { setReorderError(e.message); }
    finally { setReordering(false); }
  }

  if (!id) return <TournamentPicker />;
  if (notFound) return (
    <div className="py-10">
      <h1 className="font-display font-black text-4xl text-white">{t("tour.title")}</h1>
      <p className="text-[#a1a1aa] mt-4">
        {t("tour.notFound")}{" "}
        <Link to="/tournament" className="text-cyan hover:underline">{t("tour.createLink")}</Link>
      </p>
    </div>
  );
  if (!tournament) return <div className="py-20 text-center overline">{t("tour.loading")}</div>;

  const tabs = [["grid", t("tour.tab.grid")], ["res", t("tour.tab.res")], ["teams", t("tour.tab.teams")]];

  return (
    <div className="py-10" data-testid="tournament-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Overline className="text-cyan">// {tournament.discipline} · BO{bo}{tournament.status === "completed" ? ` · ${t("tour.completed")}` : ""}</Overline>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-2">{tournament.name}</h1>
        </div>
        {isAdmin && (
          <div className="text-right">
            <Btn size="sm" variant="danger" data-testid="tournament-delete-btn" onClick={handleDelete}>{t("tour.delete")}</Btn>
            {deleteError && <p className="text-[#ff0055] text-xs mt-2 max-w-[220px]">{deleteError}</p>}
          </div>
        )}
      </div>

      <div className="flex gap-1 mt-8 border-b border-[#27272a]">
        {tabs.map(([k, label]) => (
          <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-xs font-mono uppercase tracking-widest -mb-px border-b-2 transition-colors ${
              tab === k ? "border-cyan text-cyan" : "border-transparent text-[#a1a1aa] hover:text-white"
            }`}>{label}</button>
        ))}
      </div>

      {tab === "grid" && (
        <div className="mt-6">
          {matches.length === 0 && (
            <Panel clip className="p-6 max-w-md">
              <p className="text-[#a1a1aa] text-sm">{t("tour.notGenerated")}</p>
              {isAdmin ? (
                <>
                  {tournament.teams.length > 0 && (
                    <button
                      data-testid="go-to-teams-tab"
                      onClick={() => setTab("teams")}
                      className="block mt-3 text-cyan text-sm hover:underline"
                    >
                      {t("tour.goToTeams")}
                    </button>
                  )}
                  <Btn variant="primary" className="mt-4" data-testid="generate-btn" onClick={handleGenerate} disabled={generating}>
                    {generating ? t("tour.generating") : t("tour.generate")}
                  </Btn>
                </>
              ) : (
                <p className="text-[#52525b] text-xs mt-3">{t("auth.signInToEdit")}</p>
              )}
              {scoreError && <p className="text-[#ff0055] text-sm mt-3">{scoreError}</p>}
            </Panel>
          )}

          {matches.length > 0 && (champion ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-4 mb-6 px-5 py-4 border border-volt bg-volt/10 rounded-sm clip-corner" data-testid="champion-banner">
              <span className="overline text-volt">{t("tour.champion")}</span>
              <span className="font-display font-black text-2xl text-white">{champion}</span>
              <span className="ml-auto text-volt text-2xl">★</span>
            </motion.div>
          ) : isAdmin ? (
            <p className="text-[#a1a1aa] text-sm mb-6">{t("tour.hint")}</p>
          ) : null)}

          {matches.length > 0 && (
            <div ref={bracketRef} className="relative flex gap-10 overflow-x-auto pb-4 cursor-grab active:cursor-grabbing" data-testid="bracket">
              <svg ref={svgRef} className="wire-layer absolute top-0 left-0" width={svgSize.w} height={svgSize.h} style={{ overflow: "visible", zIndex: 0 }}>
                {connectors.map((c) => <path key={c.key} data-src={c.sourceId} d={c.d} className={"wire" + (c.live ? " live" : "")} />)}
              </svg>
              <svg ref={pulseSvgRef} className="absolute top-0 left-0 pointer-events-none" width={svgSize.w} height={svgSize.h} style={{ overflow: "visible", zIndex: 4 }} />

              {Array.from({ length: totalRounds }, (_, r) => {
                const rm = matches.filter((m) => m.round === r).sort((x, y) => x.position - y.position);
                return (
                  // The label used to sit inside the same `justify-around` flex
                  // box as the match cards, so on rounds/final with only ONE
                  // match, space-around counted the label as a sibling too and
                  // pushed the lone card way down the column instead of near
                  // the top — that's the "drifted down" gap. Label now lives
                  // outside the distribution group; only the cards share it.
                  <div key={r} className="relative z-[1] flex flex-col min-w-[220px]">
                    <Overline className="mb-1">{roundLabel(rm.length)}</Overline>
                    <div className="flex flex-col justify-around gap-4 flex-1">
                      {rm.map((m) => (
                        <MatchCard key={`${m.id}-${m.status}`} m={m} teamName={teamName} openEdit={openEdit}
                          cardRef={setNodeRef(`m-${m.id}`)} isAdmin={isAdmin}
                          enterScoreLabel={t("tour.enterScore")} byeLabel={t("tour.bye")} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="relative z-[1] flex flex-col min-w-[220px]">
                <Overline className="mb-1 text-volt">{t("tour.champion")}</Overline>
                <div className="flex flex-col justify-around flex-1">
                  {/* `layout` used to be here on the ref'd node — same class of bug
                      as MatchCard: the wire-recompute effect could measure it
                      mid-FLIP-transform and lock the connector onto a transient
                      rect. Plain div for geometry, animation stays inner-only. */}
                  <div ref={setNodeRef("champion")}
                    className="w-[220px] px-3 py-3 rounded-sm border bg-surface"
                    style={{ borderColor: champion ? "#dfff00" : "#27272a", borderStyle: champion ? "solid" : "dashed" }}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={champion ?? "empty"} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 30 }}
                        className={`block font-display font-bold ${champion ? "text-volt" : "text-[#52525b]"}`}>
                        {champion ?? "—"}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          )}

          {edit && (
            <Panel clip className="p-6 max-w-md mt-6" data-testid="score-modal">
              <h2 className="font-display font-bold text-lg text-white">{t("tour.scoreTitle")} · BO{bo}</h2>
              <p className="text-[#a1a1aa] text-sm mt-2">{edit.a} vs {edit.b} — {t("tour.scorePick")} {edit.a})</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {validScorelines(bo).map(([x, y]) => (
                  <button key={`${x}-${y}`} data-testid={`score-${x}-${y}`} onClick={() => saveScore(x, y)}
                    className="px-4 py-2 font-mono text-sm border border-[#27272a] rounded-sm hover:border-cyan hover:text-cyan transition-colors">
                    {x}:{y}
                  </button>
                ))}
              </div>
              {scoreError && <p className="text-[#ff0055] text-sm mt-3">{scoreError}</p>}
              <Btn size="sm" variant="ghost" className="mt-4" onClick={() => setEdit(null)}>{t("tour.cancel")}</Btn>
            </Panel>
          )}
        </div>
      )}

      {tab === "res" && (
        <div className="mt-6 border border-[#27272a] clip-corner overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr>{[t("tour.res.round"), t("tour.res.match"), t("tour.res.score"), t("tour.res.winner")].map((h) => (
                <th key={h} className="overline px-4 py-3 text-left border-b border-[#27272a]">{h}</th>))}</tr>
            </thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-[#52525b] text-center">{t("tour.res.empty")}</td></tr>}
              {results.map((m, i) => (
                <tr key={i} className="border-b border-[#27272a]/50 hover:bg-[#27272a]/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-[#a1a1aa]">{m.round}</td>
                  <td className="px-4 py-3 text-white">{m.a ?? "—"} — {m.b ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-cyan">{m.bye ? t("tour.bye") : `${m.sa}:${m.sb}`}</td>
                  <td className="px-4 py-3 font-display font-semibold text-white">{m.w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "teams" && (
        <Panel clip className="p-6 max-w-lg mt-6">
          <Overline>{t("tour.participants")}</Overline>
          {matches.length === 0 && isAdmin && (
            <p className="text-xs text-[#a1a1aa] mt-2">{t("tour.reorderHint")}</p>
          )}
          <div className="mt-4 divide-y divide-[#27272a]/60">
            {tournament.teams.slice().sort((x, y) => x.seed - y.seed).map((tt, i, sorted) => (
              <Reveal key={tt.id} index={i} y={10} data-testid={`participant-row-${tt.teamId}`} className="flex items-center gap-4 py-2.5">
                <span className="font-mono text-xs text-cyan w-6">{String(tt.seed).padStart(2, "0")}</span>
                <span className="text-white">{tt.team?.name}</span>
                {matches.length === 0 && isAdmin && (
                  <span className="ml-auto flex gap-1">
                    <button
                      data-testid={`participant-up-${tt.teamId}`}
                      disabled={i === 0 || reordering}
                      onClick={() => moveTeam(tt.teamId, -1)}
                      className="w-6 h-6 grid place-items-center border border-[#27272a] rounded-sm text-[#a1a1aa] hover:border-cyan hover:text-cyan transition-colors disabled:opacity-30 disabled:hover:border-[#27272a] disabled:hover:text-[#a1a1aa]"
                    >▲</button>
                    <button
                      data-testid={`participant-down-${tt.teamId}`}
                      disabled={i === sorted.length - 1 || reordering}
                      onClick={() => moveTeam(tt.teamId, 1)}
                      className="w-6 h-6 grid place-items-center border border-[#27272a] rounded-sm text-[#a1a1aa] hover:border-cyan hover:text-cyan transition-colors disabled:opacity-30 disabled:hover:border-[#27272a] disabled:hover:text-[#a1a1aa]"
                    >▼</button>
                  </span>
                )}
              </Reveal>
            ))}
          </div>
          <p className="text-xs text-[#52525b] mt-4">{tournament.teams.length} {t("tour.teamsCount")}</p>
          {reorderError && <p className="text-[#ff0055] text-sm mt-3">{reorderError}</p>}
          {matches.length === 0 && isAdmin && tournament.teams.length >= 2 && (
            <Btn variant="primary" size="sm" className="mt-4" data-testid="generate-btn-teams-tab" onClick={handleGenerate} disabled={generating}>
              {generating ? t("tour.generating") : t("tour.generate")}
            </Btn>
          )}
        </Panel>
      )}
    </div>
  );
}
