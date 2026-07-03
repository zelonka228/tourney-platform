import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DISCIPLINES, avgRating } from "../lib/demo";
import { getTeams } from "../lib/api";

export default function Profile() {
  const [sel, setSel] = useState(null);
  const [TEAMS, setTeams] = useState([]);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  // --- Список команд (картки) ---
  if (sel === null) {
    return (
      <div className="page">
        <h1>Команди</h1>
        <p className="sub">Натисніть на команду, щоб переглянути її профіль.</p>
        <div className="cards">
          {TEAMS.map((t, i) => {
            const r = avgRating(
              t.discipline,
              t.players.map((p) => p.rank)
            );
            return (
              <div className="box nav-card team-card" key={t.name} onClick={() => setSel(i)}>
                <div className="ph tlogo">{t.logo ? <img src={t.logo} alt="" /> : "лого"}</div>
                <div>
                  <h3>{t.name} →</h3>
                  <p>
                    {t.discipline} · {r.label} {r.unit}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- Профіль обраної команди ---
  const team = TEAMS[sel];
  const unit = DISCIPLINES[team.discipline].unit;
  const rating = avgRating(
    team.discipline,
    team.players.map((p) => p.rank)
  );

  return (
    <div className="page">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
      >
        <button className="btn sm" onClick={() => setSel(null)}>
          ← Усі команди
        </button>
        <Link to={`/team/${team.id}`}>Редагувати склад →</Link>
      </div>
      <h1>{team.name}</h1>

      <div className="pcols">
        <div className="tcard">
          <div className="head">
            <div className="ph logo">{team.logo ? <img src={team.logo} alt="" /> : "лого"}</div>
            <div>
              <div className="nm">{team.name}</div>
              <div className="tier">
                {team.discipline} · середній {rating.unit}: <b>{rating.label}</b>
              </div>
            </div>
          </div>
          <div className="statgrid">
            <div className="s">
              <div className="v">{team.winrate}</div>
              <div className="l">Winrate</div>
            </div>
            <div className="s">
              <div className="v">{team.streak}</div>
              <div className="l">Стрик</div>
            </div>
            <div className="s">
              <div className="v">{team.tournaments}</div>
              <div className="l">Турнірів</div>
            </div>
            <div className="s">
              <div className="v">{team.best}</div>
              <div className="l">Найкращий результат</div>
            </div>
          </div>
          <div className="roster">
            <div
              className="muted"
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: ".5px",
                marginBottom: 4,
              }}
            >
              Склад · {unit}
            </div>
            {team.players.map((p) => (
              <div className="r" key={p.nick}>
                <div className="ph pa" />
                <div>
                  {p.nick}
                  <div className="role">{p.role}</div>
                </div>
                <span className="kd">{p.rank}</span>
              </div>
            ))}
          </div>
          <div className="cardfoot">
            <button
              className="btn"
              style={{ width: "100%" }}
              onClick={() =>
                alert("У робочій версії картка рендериться у PNG (html2canvas / Puppeteer).")
              }
            >
              Зберегти картку зображенням
            </button>
          </div>
        </div>

        <div>
          <div className="box">
            <h2 style={{ marginTop: 0 }}>Рейтинг команди</h2>
            <p style={{ margin: "0 0 6px" }}>
              Середній {rating.unit}: <b>{rating.label}</b> ({team.players.length} гравців)
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Рейтинг рахується в одиниці дисципліни: CS2 — FACEIT ELO, Dota 2 — MMR, Valorant —
              звання. Команди порівнюються в межах однієї гри.
            </p>
          </div>
          <div className="box" style={{ marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Рідкість картки</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Common → Rare → Epic → Legendary. Відкривається за досягнення (виграні турніри,
              нагороди MVP). Суто візуальна колекційна позначка — лише формули та шаблон, без ШІ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
