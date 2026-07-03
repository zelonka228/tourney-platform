import { useState, useEffect } from "react";
import { avgRating } from "../lib/demo";
import { getTeams } from "../lib/api";

const DISCIPLINES = ["Усі", "CS2", "Dota 2", "Valorant"];

export default function Hall() {
  const [disc, setDisc] = useState("Усі");
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  const rows = teams
    .map((t) => {
      const r = avgRating(
        t.discipline,
        t.players.map((p) => p.rank)
      );
      return {
        name: t.name,
        discipline: t.discipline,
        rating: r.label,
        unit: r.unit,
        sort: r.value,
        winrate: t.winrate,
        tournaments: t.tournaments,
      };
    })
    .filter((t) => disc === "Усі" || t.discipline === disc)
    .sort((a, b) =>
      a.discipline === b.discipline ? b.sort - a.sort : a.discipline.localeCompare(b.discipline)
    );

  return (
    <div className="page">
      <h1>Загальний рейтинг</h1>

      <div className="tabs">
        {DISCIPLINES.map((d) => (
          <button key={d} className={disc === d ? "active" : ""} onClick={() => setDisc(d)}>
            {d}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th className="rk">#</th>
            <th>Команда</th>
            <th>Дисципліна</th>
            <th>Рейтинг</th>
            <th>Winrate</th>
            <th>Турнірів</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.name}>
              <td className="rk">{i + 1}</td>
              <td>{t.name}</td>
              <td className="muted">{t.discipline}</td>
              <td>
                <b>{t.rating}</b> <span className="muted">{t.unit}</span>
              </td>
              <td>{t.winrate}</td>
              <td className="muted">{t.tournaments}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        Рейтинг — у власній одиниці кожної гри (FACEIT ELO / MMR / звання), тож команди порівнюються
        в межах однієї дисципліни. Оберіть гру вкладкою вище.
      </p>
    </div>
  );
}
