import { BrowserRouter, NavLink, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { I18nProvider, useI18n } from "./lib/i18n";
import { AuthProvider, useAuth } from "./lib/auth";
import { Landing } from "./pages/Landing";
import { Create } from "./pages/Create";
import { Team } from "./pages/Team";
import { Profile } from "./pages/Profile";
import { Hall } from "./pages/Hall";
import { Tournament } from "./pages/Tournament";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Account } from "./pages/Account";
import { AdminUsers } from "./pages/AdminUsers";

const links = [
  { to: "/", key: "nav.home", end: true },
  { to: "/create", key: "nav.create", requiresContentManager: true },
  { to: "/tournament", key: "nav.tournament" },
  { to: "/team", key: "nav.team" },
  { to: "/profile", key: "nav.profile" },
  { to: "/hall", key: "nav.hall" },
];

function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div
      className="flex items-center border border-[#27272a] rounded-sm overflow-hidden"
      data-testid="lang-switch"
    >
      {["ua", "en"].map((l) => (
        <button
          key={l}
          data-testid={`lang-switch-${l}`}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-xs font-mono uppercase tracking-widest transition-colors ${
            lang === l ? "bg-cyan text-void font-bold" : "text-[#a1a1aa] hover:text-white"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function AuthLink() {
  const { t } = useI18n();
  const { user, isAdmin } = useAuth();
  if (!user) {
    return (
      <NavLink
        to="/login"
        data-testid="nav-login"
        className={({ isActive }) =>
          `px-3 py-1.5 text-xs font-mono uppercase tracking-widest border rounded-sm transition-colors ${
            isActive
              ? "border-cyan text-cyan"
              : "border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46]"
          }`
        }
      >
        {t("auth.signIn")}
      </NavLink>
    );
  }
  return (
    <NavLink
      to="/account"
      data-testid="nav-account"
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-[#27272a] rounded-sm hover:border-[#3f3f46] transition-colors"
    >
      <span className={`w-1.5 h-1.5 rotate-45 ${isAdmin ? "bg-volt" : "bg-cyan"}`} />
      <span className="text-white">{user.username}</span>
    </NavLink>
  );
}

function Header() {
  const { t } = useI18n();
  const { canManageContent } = useAuth();
  const nav = useNavigate();
  const visibleLinks = links.filter((l) => !l.requiresContentManager || canManageContent);
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-void/70 border-b border-[#27272a]">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-1">
        <button
          onClick={() => nav("/")}
          data-testid="brand-logo"
          className="flex items-center gap-2 mr-6 group"
        >
          <span className="w-2.5 h-2.5 bg-cyan rotate-45 group-hover:shadow-[0_0_12px_#00f0ff] transition-shadow" />
          <span className="font-display font-black text-lg tracking-tighter text-white">
            {t("brand")}
          </span>
        </button>
        <nav className="hidden md:flex items-center gap-0.5">
          {visibleLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              data-testid={`nav-${l.to === "/" ? "home" : l.to.slice(1)}`}
              className={({ isActive }) =>
                `px-3 py-2 text-[13px] font-medium rounded-sm transition-colors ${
                  isActive ? "text-cyan bg-cyan/10" : "text-[#a1a1aa] hover:text-white"
                }`
              }
            >
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <span className="flex-1" />
        <AuthLink />
        <span className="w-2" />
        <LangSwitch />
      </div>
      {/* mobile nav */}
      <nav className="md:hidden flex items-center gap-0.5 overflow-x-auto px-5 pb-2 border-t border-[#27272a]/60 pt-2">
        {visibleLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `whitespace-nowrap px-3 py-1.5 text-xs rounded-sm transition-colors ${
                isActive ? "text-cyan bg-cyan/10" : "text-[#a1a1aa]"
              }`
            }
          >
            {t(l.key)}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<Create />} />
          <Route path="/tournament/:id?" element={<Tournament />} />
          <Route path="/team/:id?" element={<Team />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/hall" element={<Hall />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function Shell() {
  const { t } = useI18n();
  return (
    <div className="grain min-h-screen relative">
      <Header />
      <main className="max-w-6xl mx-auto px-5 relative z-10">
        <AnimatedRoutes />
        <footer className="py-12 text-center overline">
          {t("brand")} · esports tournament engine
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </MotionConfig>
      </AuthProvider>
    </I18nProvider>
  );
}
