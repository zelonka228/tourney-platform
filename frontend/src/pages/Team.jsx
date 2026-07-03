import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ROLES_BY_GAME,
  DISCIPLINE_LIST,
  DISCIPLINES,
  VALORANT_RANKS,
  avgRating,
} from "../lib/demo";
import { createTeam, updateTeam, getTeam } from "../lib/api";

// Значення рейтингу за замовчуванням для нової дисципліни.
const DEFAULT_RANK = { CS2: 1800, "Dota 2": 3000, Valorant: "Diamond" };

// Приводить збережений у БД rank (завжди рядок) до вигляду, який очікує UI:
// число для CS2/Dota, рядок звання для Valorant.
function fromDbRank(discipline, rank) {
  return DISCIPLINES[discipline].kind === "rank" ? rank : Number(rank);
}

export default function Team() {
  const nav = useNavigate();
  const { id } = useParams();
  const [discipline, setDiscipline] = useState("CS2");
  const [name, setName] = useState("Night Wolves");
  const roles = ROLES_BY_GAME[discipline];
  const def = DISCIPLINES[discipline];

  const [players, setPlayers] = useState([
    { nick: "s1mple_ua", role: "AWPer", rank: 2510 },
    { nick: "blaze", role: "Entry", rank: 2180 },
    { nick: "anchor", role: "Support", rank: 1990 },
    { nick: "maestro", role: "IGL", rank: 2070 },
    { nick: "ghost", role: "Lurker", rank: 2240 },
  ]);
  const [subs, setSubs] = useState([{ nick: "spare1", role: "Support", rank: 1800 }]);

  // Якщо в URL є id — вантажимо реальну команду з бекенду замість дефолтів.
  useEffect(() => {
    if (!id) return;
    getTeam(id).then((t) => {
      if (!t) return;
      setName(t.name);
      setDiscipline(t.discipline);
      setPlayers(
        t.players
          .filter((p) => !p.isSubstitute)
          .map((p) => ({ nick: p.nick, role: p.role, rank: fromDbRank(t.discipline, p.rank) }))
      );
      setSubs(
        t.players
          .filter((p) => p.isSubstitute)
          .map((p) => ({ nick: p.nick, role: p.role, rank: fromDbRank(t.discipline, p.rank) }))
      );
    });
  }, [id]);

  // Зміна гри → переназначаємо ролі та рейтинги під нову дисципліну.
  function changeDiscipline(d) {
    const nr = ROLES_BY_GAME[d];
    const isRank = DISCIPLINES[d].kind === "rank";
    const valid = (v) => (isRank ? VALORANT_RANKS.includes(v) : typeof v === "number");
    const remap = (list) =>
      list.map((p, i) => ({
        ...p,
        role: nr.includes(p.role) ? p.role : nr[i % nr.length],
        rank: valid(p.rank) ? p.rank : DEFAULT_RANK[d],
      }));
    setPlayers(remap);
    setSubs(remap);
    setDiscipline(d);
  }

  const teamRating = avgRating(
    discipline,
    players.map((p) => p.rank)
  );

  // Збереження команди: збираємо основу + запасних і викликаємо API.
  // Fire-and-forget — не блокуємо навігацію.
  function save() {
    const payload = {
      name,
      discipline,
      players: [
        ...players.map((p) => ({
          nick: p.nick,
          role: p.role,
          rank: String(p.rank),
          isSubstitute: false,
        })),
        ...subs.map((p) => ({
          nick: p.nick,
          role: p.role,
          rank: String(p.rank),
          isSubstitute: true,
        })),
      ],
    };
    if (id) {
      updateTeam(id, payload);
    } else {
      createTeam(payload);
    }
    nav("/profile");
  }

  // Поле рейтингу: число (CS2/Dota) або select звань (Valorant).
  const rankField = (p, onChange) =>
    def.kind === "rank" ? (
      <select value={p.rank} onChange={(e) => onChange(e.target.value)}>
        {VALORANT_RANKS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
    ) : (
      <input type="number" value={p.rank} onChange={(e) => onChange(+e.target.value)} />
    );

  const editor = (list, setList, max, addLabel) => (
    <>
      <div
        className="plRow muted"
        style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".5px" }}
      >
        <span>#</span>
        <span>Нік</span>
        <span>Роль</span>
        <span>{def.unit}</span>
        <span />
      </div>
      {list.map((p, i) => (
        <div className="plRow" key={i}>
          <span className="pn">{i + 1}</span>
          <input
            value={p.nick}
            onChange={(e) =>
              setList((l) => l.map((x, idx) => (idx === i ? { ...x, nick: e.target.value } : x)))
            }
          />
          <select
            value={p.role}
            onChange={(e) =>
              setList((l) => l.map((x, idx) => (idx === i ? { ...x, role: e.target.value } : x)))
            }
          >
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {rankField(p, (v) =>
            setList((l) => l.map((x, idx) => (idx === i ? { ...x, rank: v } : x)))
          )}
          <button className="xbtn" onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}>
            ×
          </button>
        </div>
      ))}
      <button
        className="btn sm"
        style={{ marginTop: 6 }}
        disabled={list.length >= max}
        onClick={() =>
          setList((l) => [...l, { nick: "", role: roles[0], rank: DEFAULT_RANK[discipline] }])
        }
      >
        {addLabel}
      </button>
    </>
  );

  return (
    <div className="page">
      <h1>Команда</h1>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="box" style={{ width: 240 }}>
          <label>Лого команди</label>
          <div className="ph" style={{ height: 120, borderRadius: 6 }}>
            завантажити
          </div>
          <button className="btn sm" style={{ marginTop: 10, width: "100%" }}>
            Вибрати файл
          </button>
        </div>

        <div className="box" style={{ flex: 1, minWidth: 320 }}>
          <div className="field">
            <label>Назва команди</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Дисципліна</label>
            <select value={discipline} onChange={(e) => changeDiscipline(e.target.value)}>
              {DISCIPLINE_LIST.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="champ" style={{ marginBottom: 18 }}>
            <span className="lbl">Середній {teamRating.unit}</span>
            <span className="nm">{teamRating.label}</span>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>
              {players.length} гравців основи
            </span>
          </div>

          <h2 style={{ marginTop: 6 }}>Основний склад</h2>
          {editor(players, setPlayers, 7, "+ Додати гравця")}

          <h2>Запасні гравці</h2>
          {editor(subs, setSubs, 5, "+ Додати запасного")}

          <div style={{ marginTop: 16 }}>
            <button className="btn solid" onClick={save}>
              Зберегти команду
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
