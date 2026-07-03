import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { bracketPlan, BEST_OF, winTarget } from "../lib/demo";

export default function Create() {
  const nav = useNavigate();
  const [name, setName] = useState("LAN Cup");
  const [bracket, setBracket] = useState("На вибування (виліт за 1 поразку)");
  const [bo, setBo] = useState(3);
  const [count, setCount] = useState(8);
  const plan = bracketPlan(count);

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
                <option>На вибування (виліт за 1 поразку)</option>
                <option>Подвійне вибування (виліт за 2 поразки)</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Кількість команд</label>
              <select value={count} onChange={(e) => setCount(+e.target.value)}>
                {[4, 8, 16, 32].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
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
            <div className="field" style={{ flex: 1 }}>
              <label>Дисципліна</label>
              <select>
                <option>CS2</option>
                <option>Dota 2</option>
                <option>Valorant</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>Дата проведення</label>
              <input type="date" defaultValue="2026-07-12" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Посів учасників</label>
              <select>
                <option>Випадковий</option>
                <option>За рейтингом</option>
                <option>Ручний</option>
              </select>
            </div>
          </div>
          <button className="btn solid" onClick={() => nav("/tournament")}>
            Згенерувати сітку
          </button>
        </div>

        <div className="box" style={{ width: 300 }}>
          <h2 style={{ marginTop: 0 }}>Попередній перегляд</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            Тип сітки: <b>{bracket.split(" (")[0]}</b>
            <br />
            Формат матчу: <b>BO{bo}</b> (до {winTarget(bo)} перемог){bo === 1 ? "" : ""}
            <br />
            Команд: <b>{count}</b>
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
            {plan.byes === 0
              ? `${count} команд — степінь двійки, «баї» не потрібні.`
              : `${count} команд → доповнюємо до ${plan.full} через ${plan.byes} «бай» (автопрохід без матчу).`}
          </div>
        </div>
      </div>
    </div>
  );
}
