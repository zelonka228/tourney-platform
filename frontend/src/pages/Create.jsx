import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { bracketPlan, BEST_OF, winTarget, DISCIPLINE_LIST, avgRating } from "../lib/demo";
import { getTeams, createTournament } from "../lib/api";

const SINGLE_LABEL = "На вибування (виліт за 1 поразку)";
const DOUBLE_LABEL = "Подвійне вибування (виліт за 2 поразки)";

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Порядок teamIds = порядок посіву (перший — seed 1). "За рейтингом" сортує
// найсильніших першими, "Випадковий" перемішує, "Ручний" лишає порядок кліків.
function seedTeamIds(selectedIds, allTeams, seedType) {
  if (seedType === "Випадковий") return shuffled(selectedIds);
  if (seedType === "За рейтингом") {
    const byId = new Map(allTeams.map((t) => [t.id, t]));
    const ratingOf = (id) => {
      const t = byId.get(id);
      return avgRating(t.discipline, t.players.map((p) => p.rank)).value ?? -Infinity;
    };
    return [...selectedIds].sort((a, b) => ratingOf(b) - ratingOf(a));
  }
  return selectedIds;
}

export default function Create() {
  const nav = useNavigate();
  const [name, setName] = useState("LAN Cup");
  const [bracket, setBracket] = useState(SINGLE_LABEL);
  const [bo, setBo] = useState(3);
  const [discipline, setDiscipline] = useState("CS2");
  const [date, setDate] = useState("2026-07-12");
  const [seedType, setSeedType] = useState("За рейтингом");

  const [allTeams, setAllTeams] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTeams().then(setAllTeams);
  }, []);

  // Зміна дисципліни очищає вибір — не можна змішувати команди різних ігор в одному турнірі.
  function changeDiscipline(d) {
    setDiscipline(d);
    setSelectedIds([]);
  }

  function toggleTeam(id) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const teamsInDiscipline = allTeams.filter((t) => t.discipline === discipline);
  const isDouble = bracket === DOUBLE_LABEL;
  const plan = bracketPlan(Math.max(selectedIds.length, 1));
  const canSubmit = !isDouble && selectedIds.length >= 2 && name.trim() !== "" && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTournament({
        name,
        discipline,
        bracketType: isDouble ? "double" : "single",
        matchFormat: bo,
        teamIds: seedTeamIds(selectedIds, allTeams, seedType),
        date,
      });
      if (!created?.id) throw new Error("Не вдалося створити турнір.");
      nav(`/tournament/${created.id}`);
    } catch (e) {
      setError(e.message || "Не вдалося створити турнір.");
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Створення турніру</h1>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="box" style={{ flex: 1, minWidth: 300 }}>
          <div className="field">
            <label>Назва турніру</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>Тип сітки</label>
              <select value={bracket} onChange={(e) => setBracket(e.target.value)}>
                <option>{SINGLE_LABEL}</option>
                <option>{DOUBLE_LABEL}</option>
              </select>
              {isDouble && (
                <div className="hint" style={{ marginTop: 4 }}>
                  Подвійне вибування ще не підтримується — оберіть «На вибування».
                </div>
              )}
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Формат матчу</label>
              <select value={bo} onChange={(e) => setBo(+e.target.value)}>
                {BEST_OF.map((n) => (
                  <option key={n} value={n}>
                    BO{n} — до {winTarget(n)} перемог{winTarget(n) > 1 ? "" : "и"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>Дисципліна</label>
              <select value={discipline} onChange={(e) => changeDiscipline(e.target.value)}>
                {DISCIPLINE_LIST.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Дата проведення</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Посів учасників</label>
            <select value={seedType} onChange={(e) => setSeedType(e.target.value)}>
              <option>Випадковий</option>
              <option>За рейтингом</option>
              <option>Ручний</option>
            </select>
          </div>

          <div className="field">
            <label>Учасники ({discipline})</label>
            {teamsInDiscipline.length === 0 && (
              <div className="hint">Немає команд у цій дисципліні — створіть команду спочатку.</div>
            )}
            {teamsInDiscipline.map((t) => (
              <label key={t.id} className="plRow" style={{ gridTemplateColumns: "24px 1fr" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleTeam(t.id)}
                />
                <span>{t.name}</span>
              </label>
            ))}
          </div>

          {error && (
            <div className="hint" style={{ color: "var(--danger, #c0392b)" }}>
              {error}
            </div>
          )}

          <button className="btn solid" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Створення…" : "Згенерувати сітку"}
          </button>
        </div>

        <div className="box" style={{ width: 300 }}>
          <h2 style={{ marginTop: 0 }}>Попередній перегляд</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            Тип сітки: <b>{bracket.split(" (")[0]}</b>
            <br />
            Формат матчу: <b>BO{bo}</b> (до {winTarget(bo)} перемог)
            <br />
            Команд обрано: <b>{selectedIds.length}</b>
            <br />
            Раундів: <b>{plan.rounds}</b>
            <br />
            Матчів: <b>{plan.matches}</b>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>
            BO{bo}: матч грається до {winTarget(bo)} виграних карт
            {bo > 1 ? `, максимум ${bo} карт` : ""}.
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {selectedIds.length < 2
              ? "Оберіть щонайменше 2 команди."
              : plan.byes === 0
                ? `${selectedIds.length} команд — степінь двійки, «баї» не потрібні.`
                : `${selectedIds.length} команд → доповнюємо до ${plan.full} через ${plan.byes} «бай» (автопрохід без матчу).`}
          </div>
        </div>
      </div>
    </div>
  );
}
