import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Create from "./pages/Create";
import Tournament from "./pages/Tournament";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import Hall from "./pages/Hall";

const links = [
  { to: "/", label: "Головна", end: true },
  { to: "/create", label: "Створити турнір" },
  { to: "/tournament", label: "Турнір" },
  { to: "/team", label: "Команда" },
  { to: "/profile", label: "Команди" },
  { to: "/hall", label: "Рейтинг" },
];

export default function App() {
  const nav = useNavigate();
  return (
    <>
      <header>
        <div className="wrap nav">
          <span className="brand" onClick={() => nav("/")}>
            Турнірна платформа
          </span>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
          <span className="sp" />
        </div>
      </header>
      <div className="wrap">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<Create />} />
          <Route path="/tournament/:id?" element={<Tournament />} />
          <Route path="/team/:id?" element={<Team />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/hall" element={<Hall />} />
        </Routes>
        <footer>Турнірна платформа</footer>
      </div>
    </>
  );
}
