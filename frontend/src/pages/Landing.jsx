import { useNavigate } from "react-router-dom";

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="page">
      <div className="hero">
        <h1>Турніри з автоматичною сіткою та профілем команди</h1>
        <p>Створіть турнір за хвилину, ведіть результати наживо й розвивайте рейтинг команди.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn solid" onClick={() => nav("/create")}>
            Створити турнір
          </button>
        </div>
      </div>

      <h2>Розділи</h2>
      <div className="cards">
        <div className="box nav-card" onClick={() => nav("/tournament")}>
          <h3>Турнір →</h3>
          <p>Сітка матчів і введення результатів.</p>
        </div>
        <div className="box nav-card" onClick={() => nav("/team")}>
          <h3>Команда →</h3>
          <p>Створити команду та додати гравців.</p>
        </div>
        <div className="box nav-card" onClick={() => nav("/hall")}>
          <h3>Рейтинг →</h3>
          <p>Загальна таблиця команд платформи.</p>
        </div>
      </div>
    </div>
  );
}
