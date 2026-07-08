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

const LOGO_SIZE = 256; // px, квадрат
const LOGO_MAX_BYTES = 300 * 1024; // грубий ліміт на base64-рядок у БД

// Читає файл зображення, вписує його в квадрат LOGO_SIZE×LOGO_SIZE (crop по
// центру, як object-fit: cover) і повертає JPEG data URL — щоб не роздувати
// БД оригіналами в кілька мегапікселів і не тримати сирі File-об'єкти в стейті.
function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Оберіть файл зображення."));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = LOGO_SIZE;
      canvas.height = LOGO_SIZE;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(LOGO_SIZE / img.width, LOGO_SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (LOGO_SIZE - w) / 2, (LOGO_SIZE - h) / 2, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (dataUrl.length > LOGO_MAX_BYTES) {
        reject(new Error("Зображення завелике навіть після стиснення — оберіть інше."));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не вдалося прочитати зображення."));
    };
    img.src = url;
  });
}

export default function Team() {
  const nav = useNavigate();
  const { id } = useParams();
  const [discipline, setDiscipline] = useState("CS2");
  const [name, setName] = useState("Night Wolves");
  const [logo, setLogo] = useState(null);
  const [logoError, setLogoError] = useState(null);
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
      setLogo(t.logo ?? null);
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

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // дозволяє повторно обрати той самий файл
    if (!file) return;
    setLogoError(null);
    try {
      setLogo(await readLogoFile(file));
    } catch (err) {
      setLogoError(err.message);
    }
  }

  // Збереження команди: збираємо основу + запасних і викликаємо API.
  // Fire-and-forget — не блокуємо навігацію.
  function save() {
    const payload = {
      name,
      discipline,
      logo,
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
          {logo ? (
            <img
              src={logo}
              alt="Лого команди"
              style={{ width: "100%", height: 120, borderRadius: 6, objectFit: "cover" }}
            />
          ) : (
            <div className="ph" style={{ height: 120, borderRadius: 6 }}>
              завантажити
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            id="logo-input"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
            onChange={handleLogoChange}
          />
          <label
            htmlFor="logo-input"
            className="btn sm"
            style={{ marginTop: 10, width: "100%", textAlign: "center" }}
          >
            {logo ? "Змінити файл" : "Вибрати файл"}
          </label>
          {logo && (
            <button
              className="btn sm"
              style={{ marginTop: 6, width: "100%" }}
              onClick={() => setLogo(null)}
            >
              Видалити лого
            </button>
          )}
          {logoError && (
            <div className="hint" style={{ color: "var(--danger, #c0392b)", marginTop: 6 }}>
              {logoError}
            </div>
          )}
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
