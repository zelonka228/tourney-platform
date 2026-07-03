import { useMemo, useState } from "react";
import { TEAMS, BEST_OF, winTarget, validScorelines } from "../lib/demo";

const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

// Стандартний порядок посіву: повертає номери посівів за позиціями в сітці.
// Напр. size=8 → [1,8,4,5,2,7,3,6]. Так найсильніші посіви грають проти найслабших
// (а коли команд менше за розмір сітки — саме вони отримують «бай»).
function seedOrder(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

function roundLabel(matchesInRound) {
  if (matchesInRound === 1) return "Фінал";
  if (matchesInRound === 2) return "1/2 фіналу";
  if (matchesInRound === 4) return "1/4 фіналу";
  if (matchesInRound === 8) return "1/8 фіналу";
  return `1/${matchesInRound} фіналу`;
}

export default function Tournament() {
  const [tab, setTab] = useState("grid");
  // Учасники — користувач може редагувати їх сам.
  const [participants, setParticipants] = useState(TEAMS.map((t) => t.name));
  // Формат матчу (best-of); за замовчуванням BO3.
  const [bo, setBo] = useState(3);
  // Рахунки матчів: ключ `${round}-${match}` -> { sa, sb }.
  // Перший раунд заповнений за замовчуванням (валідні рахунки BO3), щоб сітка була «жива».
  const [scores, setScores] = useState({
    "0-0": { sa: 2, sb: 1 },
    "0-1": { sa: 0, sb: 2 },
    "0-2": { sa: 2, sb: 0 },
    "0-3": { sa: 1, sb: 2 },
  });
  const [edit, setEdit] = useState(null); // { r, m, a, b }

  const size = nextPow2(participants.length);
  const totalRounds = Math.log2(size);
  const order = useMemo(() => seedOrder(size), [size]);

  // Команда у конкретному слоті матчу (рекурсивно з попередніх раундів).
  // У першому раунді слоти заповнюються за посівом; зайві позиції — «бай» (null).
  function teamAt(r, m, slot) {
    if (r === 0) {
      const seed = order[m * 2 + slot];
      return seed <= participants.length ? participants[seed - 1] : null;
    }
    return winnerOf(r - 1, m * 2 + slot);
  }
  // Переможець матчу. «Бай» (автопрохід) можливий лише в першому раунді —
  // у наступних раундах порожній слот означає «суперник ще не визначений», а не бай.
  function winnerOf(r, m) {
    const a = teamAt(r, m, 0);
    const b = teamAt(r, m, 1);
    if (r === 0) {
      if (a && !b) return a;
      if (b && !a) return b;
    }
    if (a && b) {
      const sc = scores[`${r}-${m}`];
      if (sc && sc.sa !== sc.sb) return sc.sa > sc.sb ? a : b;
    }
    return null;
  }

  const champion = winnerOf(totalRounds - 1, 0);

  // Список усіх завершених матчів (для вкладки «Результати»).
  const results = useMemo(() => {
    const out = [];
    for (let r = 0; r < totalRounds; r++) {
      const cnt = size / 2 ** (r + 1);
      for (let m = 0; m < cnt; m++) {
        const a = teamAt(r, m, 0),
          b = teamAt(r, m, 1),
          sc = scores[`${r}-${m}`];
        if (a && b && sc && sc.sa !== sc.sb)
          out.push({ round: roundLabel(cnt), a, b, sa: sc.sa, sb: sc.sb, w: winnerOf(r, m) });
      }
    }
    return out;
  }, [scores, participants]); // eslint-disable-line

  function openEdit(r, m) {
    const a = teamAt(r, m, 0),
      b = teamAt(r, m, 1);
    if (!a || !b) return; // бай або ще не визначено суперника
    setEdit({ r, m, a, b });
  }
  function saveScore(sa, sb) {
    setScores((prev) => ({ ...prev, [`${edit.r}-${edit.m}`]: { sa, sb } }));
    setEdit(null);
  }
  function resetTournament() {
    setScores({});
    setEdit(null);
  }
  function changeBo(v) {
    setBo(v);
    resetTournament();
  } // зміна формату очищає рахунки

  // --- редагування учасників ---
  const renameP = (i, v) => setParticipants((p) => p.map((x, idx) => (idx === i ? v : x)));
  const removeP = (i) => {
    setParticipants((p) => p.filter((_, idx) => idx !== i));
    resetTournament();
  };
  const addP = () => {
    setParticipants((p) => [...p, `Команда ${p.length + 1}`]);
    resetTournament();
  };

  return (
    <div className="page">
      <h1>LAN Cup</h1>

      <div className="field" style={{ maxWidth: 240, marginBottom: 12 }}>
        <label>Формат матчу</label>
        <select value={bo} onChange={(e) => changeBo(+e.target.value)}>
          {BEST_OF.map((n) => (
            <option key={n} value={n}>
              BO{n} (до {winTarget(n)} перемог)
            </option>
          ))}
        </select>
      </div>

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
          {champion ? (
            <div className="champ">
              <span className="lbl">Чемпіон</span>
              <span className="nm">{champion}</span>
              <button className="btn sm" style={{ marginLeft: "auto" }} onClick={resetTournament}>
                Почати заново
              </button>
            </div>
          ) : (
            <p className="sub" style={{ marginBottom: 14 }}>
              Натисніть матч з рамкою <b>«ввести рахунок»</b> — переможець пройде далі.
            </p>
          )}

          <div className="bracket">
            {Array.from({ length: totalRounds }, (_, r) => {
              const cnt = size / 2 ** (r + 1);
              return (
                <div className="round" key={r}>
                  <div className="rname">{roundLabel(cnt)}</div>
                  {Array.from({ length: cnt }, (_, m) => {
                    const a = teamAt(r, m, 0),
                      b = teamAt(r, m, 1),
                      w = winnerOf(r, m);
                    const sc = scores[`${r}-${m}`];
                    const decided = !!w;
                    const isBye = r === 0 && ((a && !b) || (b && !a)); // бай лише в 1-му раунді
                    const todo = a && b && !decided; // можна заповнити просто зараз
                    const pending = (!a || !b) && !isBye; // чекає на суперників
                    const cls = "match" + (todo ? " todo" : "") + (pending ? " pending" : "");
                    const emptyLabel = "—";
                    return (
                      <div className={cls} key={m} onClick={() => openEdit(r, m)}>
                        <div
                          className={
                            "team" + (w && w === a ? " win" : "") + (!a && isBye ? " bye" : "")
                          }
                        >
                          <span className="nm">{a ?? emptyLabel}</span>
                          <span className="score">{sc ? sc.sa : ""}</span>
                        </div>
                        <div
                          className={
                            "team" + (w && w === b ? " win" : "") + (!b && isBye ? " bye" : "")
                          }
                        >
                          <span className="nm">{b ?? emptyLabel}</span>
                          <span className="score">{sc ? sc.sb : ""}</span>
                        </div>
                        <div className="cue">ввести рахунок</div>
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
                  {m.a} — {m.b}
                </td>
                <td>
                  {m.sa}:{m.sb}
                </td>
                <td>{m.w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "teams" && (
        <div className="box" style={{ maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>Учасники</h2>
          {participants.map((name, i) => (
            <div className="plRow" key={i} style={{ gridTemplateColumns: "30px 1fr 34px" }}>
              <span className="pn">{i + 1}</span>
              <input value={name} onChange={(e) => renameP(i, e.target.value)} />
              <button
                className="xbtn"
                onClick={() => removeP(i)}
                disabled={participants.length <= 2}
              >
                ×
              </button>
            </div>
          ))}
          <button className="btn sm" style={{ marginTop: 6 }} onClick={addP}>
            + Додати команду
          </button>
          <div className="hint" style={{ marginTop: 12 }}>
            {participants.length} команд → сітка на {size}.{" "}
            {size - participants.length > 0
              ? `${size - participants.length} «бай» (автопрохід без матчу).`
              : "Степінь двійки — баї не потрібні."}
          </div>
        </div>
      )}
    </div>
  );
}
