import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { validScorelines } from "../lib/demo";
import {
  getTournament,
  getTournaments,
  submitMatchScore,
  generateBracket,
  deleteTournament,
} from "../lib/api";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function roundLabel(matchesInRound) {
  if (matchesInRound === 1) return "Фінал";
  if (matchesInRound === 2) return "1/2 фіналу";
  if (matchesInRound === 4) return "1/4 фіналу";
  if (matchesInRound === 8) return "1/8 фіналу";
  return `1/${matchesInRound} фіналу`;
}

// Список турнірів — коли зайшли на /tournament без id.
function TournamentPicker() {
  const [list, setList] = useState(null);
  useEffect(() => {
    getTournaments().then(setList);
  }, []);
  return (
    <div className="page">
      <h1>Турнір</h1>
      {list === null && <p className="muted">Завантаження…</p>}
      {list?.length === 0 && (
        <p className="sub">
          Ще немає жодного турніру. <Link to="/create">Створити турнір →</Link>
        </p>
      )}
      {list?.map((t) => (
        <div className="box nav-card" key={t.id} style={{ marginBottom: 8 }}>
          <Link to={`/tournament/${t.id}`}>
            <h3>{t.name} →</h3>
          </Link>
          <p className="muted">
            {t.discipline} · BO{t.matchFormat} · {t.status}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Tournament() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("grid");
  const [edit, setEdit] = useState(null); // { matchId, a, b }
  const [scoreError, setScoreError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;
    setTournament(null);
    setNotFound(false);
    getTournament(id).then((t) => {
      if (!t) setNotFound(true);
      else setTournament(t);
    });
  }, [id]);

  // Live-оновлення: приєднуємось до кімнати турніру, мерджимо чужі результати
  // матчів у локальний стан без перезавантаження сторінки.
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

  function mergeMatches(...updatedMatches) {
    setTournament((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.matches.map((m) => [m.id, m]));
      for (const m of updatedMatches) if (m) byId.set(m.id, m);
      return { ...prev, matches: [...byId.values()] };
    });
  }

  const teamName = (teamId) =>
    tournament?.teams.find((tt) => tt.teamId === teamId)?.team?.name ?? null;

  const matches = tournament?.matches ?? [];
  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) + 1 : 0;
  const bo = tournament?.matchFormat ?? 3;

  const finalMatch = matches.find((m) => m.round === totalRounds - 1);
  const champion = useMemo(() => {
    if (!finalMatch) return null;
    if (finalMatch.status === "bye") return teamName(finalMatch.teamAId ?? finalMatch.teamBId);
    if (finalMatch.status === "done") {
      const winnerId = finalMatch.scoreA > finalMatch.scoreB ? finalMatch.teamAId : finalMatch.teamBId;
      return teamName(winnerId);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalMatch, tournament]);

  const results = useMemo(() => {
    return matches
      .filter((m) => m.status === "done" || m.status === "bye")
      .map((m) => {
        const cnt = matches.filter((x) => x.round === m.round).length;
        const winnerId =
          m.status === "bye"
            ? (m.teamAId ?? m.teamBId)
            : m.scoreA > m.scoreB
              ? m.teamAId
              : m.teamBId;
        return {
          round: roundLabel(cnt),
          a: teamName(m.teamAId),
          b: teamName(m.teamBId),
          bye: m.status === "bye",
          sa: m.scoreA,
          sb: m.scoreB,
          w: teamName(winnerId),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, tournament]);

  function openEdit(m) {
    if (m.teamAId && m.teamBId && m.status === "pending") {
      setEdit({ matchId: m.id, a: teamName(m.teamAId), b: teamName(m.teamBId) });
      setScoreError(null);
    }
  }

  async function saveScore(sa, sb) {
    try {
      const res = await submitMatchScore(edit.matchId, sa, sb);
      mergeMatches(res.match, res.advanced);
      setEdit(null);
    } catch (e) {
      setScoreError(e.message || "Не вдалося зберегти рахунок.");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Видалити турнір «${tournament.name}»? Це незворотно.`)) return;
    await deleteTournament(id);
    nav("/tournament");
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const updated = await generateBracket(id);
      setTournament(updated);
    } catch (e) {
      setScoreError(e.message || "Не вдалося згенерувати сітку.");
    } finally {
      setGenerating(false);
    }
  }

  if (!id) return <TournamentPicker />;
  if (notFound) {
    return (
      <div className="page">
        <h1>Турнір</h1>
        <p className="sub">
          Турнір не знайдено. <Link to="/tournament">Усі турніри →</Link>
        </p>
      </div>
    );
  }
  if (!tournament) return <div className="page">Завантаження…</div>;

  return (
    <div className="page">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{tournament.name}</h1>
        <button className="btn sm" onClick={handleDelete}>
          Видалити турнір
        </button>
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>
        {tournament.discipline} · BO{bo}
        {tournament.status === "completed" ? " · завершено" : ""}
      </p>

      <div className="tabs">
        <button className={tab === "grid" ? "active" : ""} onClick={() => setTab("grid")}>
          Сітка
        </button>
        <button className={tab === "res" ? "active" : ""} onClick={() => setTab("res")}>
          Результати
        </button>
        <button className={tab === "teams" ? "active" : ""} onClick={() => setTab("teams")}>
          Команди
        </button>
      </div>

      {tab === "grid" && (
        <>
          {matches.length === 0 && (
            <div className="box" style={{ maxWidth: 460 }}>
              <p className="sub">Сітку для цього турніру ще не згенеровано.</p>
              <button className="btn solid" onClick={handleGenerate} disabled={generating}>
                {generating ? "Генерація…" : "Згенерувати сітку"}
              </button>
              {scoreError && <p className="hint">{scoreError}</p>}
            </div>
          )}

          {matches.length > 0 && champion ? (
            <div className="champ">
              <span className="lbl">Чемпіон</span>
              <span className="nm">{champion}</span>
            </div>
          ) : (
            matches.length > 0 && (
              <p className="sub" style={{ marginBottom: 14 }}>
                Натисніть матч з рамкою <b>«ввести рахунок»</b> — переможець пройде далі.
              </p>
            )
          )}

          {matches.length > 0 && (
            <div className="bracket">
              {Array.from({ length: totalRounds }, (_, r) => {
                const roundMatches = matches
                  .filter((m) => m.round === r)
                  .sort((x, y) => x.position - y.position);
                return (
                  <div className="round" key={r}>
                    <div className="rname">{roundLabel(roundMatches.length)}</div>
                    {roundMatches.map((m) => {
                      const a = teamName(m.teamAId);
                      const b = teamName(m.teamBId);
                      const isBye = m.status === "bye";
                      const decided = m.status === "done" || isBye;
                      const winnerId = isBye
                        ? (m.teamAId ?? m.teamBId)
                        : m.status === "done"
                          ? m.scoreA > m.scoreB
                            ? m.teamAId
                            : m.teamBId
                          : null;
                      const todo = a && b && m.status === "pending";
                      const pending = (!a || !b) && !isBye;
                      const cls =
                        "match" +
                        (todo ? " todo" : "") +
                        (pending ? " pending" : "") +
                        (isBye ? " bye" : "");
                      const emptyLabel = "—";
                      return (
                        <div className={cls} key={m.id} onClick={() => openEdit(m)}>
                          <div
                            className={
                              "team" +
                              (decided && winnerId === m.teamAId ? " win" : "") +
                              (!a && isBye ? " bye" : "")
                            }
                          >
                            <span className="nm">{a ?? emptyLabel}</span>
                            <span className="score">{m.status === "done" ? m.scoreA : ""}</span>
                          </div>
                          <div
                            className={
                              "team" +
                              (decided && winnerId === m.teamBId ? " win" : "") +
                              (!b && isBye ? " bye" : "")
                            }
                          >
                            <span className="nm">{b ?? emptyLabel}</span>
                            <span className="score">{m.status === "done" ? m.scoreB : ""}</span>
                          </div>
                          {todo && <div className="cue">ввести рахунок</div>}
                          {isBye && <div className="cue">бай</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className="round">
                <div className="rname">Чемпіон</div>
                <div className="match" style={{ borderStyle: champion ? "solid" : "dashed" }}>
                  <div className="team">
                    <span className="nm">{champion ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {edit && (
            <div className="box" style={{ maxWidth: 460, marginTop: 14 }}>
              <h2 style={{ marginTop: 0 }}>Рахунок матчу · BO{bo}</h2>
              <div className="muted" style={{ marginBottom: 10 }}>
                {edit.a} проти {edit.b} — оберіть рахунок (зліва — {edit.a}):
              </div>
              <div className="row">
                {validScorelines(bo).map(([x, y]) => (
                  <button key={`${x}-${y}`} className="btn" onClick={() => saveScore(x, y)}>
                    {x}:{y}
                  </button>
                ))}
              </div>
              {scoreError && (
                <p className="hint" style={{ color: "var(--danger, #c0392b)" }}>
                  {scoreError}
                </p>
              )}
              <div style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => setEdit(null)}>
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "res" && (
        <table>
          <thead>
            <tr>
              <th>Раунд</th>
              <th>Матч</th>
              <th>Рахунок</th>
              <th>Переможець</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Ще немає завершених матчів
                </td>
              </tr>
            )}
            {results.map((m, i) => (
              <tr key={i}>
                <td>{m.round}</td>
                <td>
                  {m.a ?? "—"} — {m.b ?? "—"}
                </td>
                <td>{m.bye ? "бай" : `${m.sa}:${m.sb}`}</td>
                <td>{m.w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "teams" && (
        <div className="box" style={{ maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>Учасники</h2>
          {tournament.teams
            .slice()
            .sort((x, y) => x.seed - y.seed)
            .map((tt) => (
              <div className="plRow" key={tt.id} style={{ gridTemplateColumns: "30px 1fr" }}>
                <span className="pn">{tt.seed}</span>
                <span>{tt.team?.name}</span>
              </div>
            ))}
          <div className="hint" style={{ marginTop: 12 }}>
            {tournament.teams.length} команд у турнірі.
          </div>
        </div>
      )}
    </div>
  );
}
