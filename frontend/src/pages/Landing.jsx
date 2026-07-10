import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams, getTournaments, getTournament } from "../lib/api";
import { Btn, Overline, Panel } from "../components/arena";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// Реальна статистика (не заглушка) — рахуємо команди/турніри з бекенду і
// матчі зі статусом "done" по кожному турніру (список турнірів не містить
// matches, тому довантажуємо деталі паралельно; невелика к-сть турнірів у
// навчальному проєкті робить це дешевим).
function useLiveStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [teams, tournaments] = await Promise.all([getTeams(), getTournaments()]);
      const details = await Promise.all(tournaments.map((t) => getTournament(t.id)));
      const matchesPlayed = details.reduce(
        (sum, t) => sum + (t?.matches?.filter((m) => m.status === "done").length ?? 0),
        0
      );
      if (!cancelled) {
        setStats({ teams: teams.length, tournaments: tournaments.length, matches: matchesPlayed });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

export function Landing() {
  const nav = useNavigate();
  const { t } = useI18n();
  const stats = useLiveStats();

  const cards = [
    { to: "/tournament", key: "tournament", tag: "01" },
    { to: "/team", key: "team", tag: "02" },
    { to: "/hall", key: "hall", tag: "03" },
  ];
  const statRow = [
    { v: stats?.tournaments ?? "—", key: "landing.stats.tournaments" },
    { v: stats?.teams ?? "—", key: "landing.stats.teams" },
    { v: stats?.matches ?? "—", key: "landing.stats.matches" },
  ];

  return (
    <div className="py-10" data-testid="landing-page">
      {/* HERO */}
      <section className="relative overflow-hidden border border-[#27272a] clip-corner">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/7862508/pexels-photo-7862508.jpeg"
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/30" />
          <div className="absolute inset-0 scanlines" />
        </div>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative z-10 px-6 sm:px-12 py-20 sm:py-28 max-w-3xl"
        >
          <motion.div variants={item}>
            <Overline className="text-cyan">// {t("landing.badge")}</Overline>
          </motion.div>
          <motion.h1
            variants={item}
            className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-[0.95] mt-5 text-white"
          >
            {t("landing.title")}
          </motion.h1>
          <motion.p variants={item} className="text-[#a1a1aa] text-base sm:text-lg mt-5 max-w-xl">
            {t("landing.sub")}
          </motion.p>
          <motion.div variants={item} className="flex flex-wrap gap-3 mt-9">
            <Btn variant="primary" data-testid="hero-create-btn" onClick={() => nav("/create")}>
              {t("landing.cta")}
            </Btn>
            <Btn variant="ghost" data-testid="hero-browse-btn" onClick={() => nav("/tournament")}>
              {t("landing.ctaSecondary")}
            </Btn>
          </motion.div>
        </motion.div>
      </section>

      {/* STATS */}
      <div className="grid grid-cols-3 border-x border-b border-[#27272a] divide-x divide-[#27272a]">
        {statRow.map((s) => (
          <div key={s.key} className="px-4 sm:px-8 py-6">
            <div className="font-mono text-3xl sm:text-4xl text-cyan leading-none">{s.v}</div>
            <div className="overline mt-2">{t(s.key)}</div>
          </div>
        ))}
      </div>

      {/* SECTIONS */}
      <div className="mt-16">
        <Overline>{t("landing.sections")}</Overline>
        <div className="grid md:grid-cols-3 gap-4 mt-5">
          {cards.map((c, i) => (
            <motion.button
              key={c.to}
              data-testid={`section-card-${c.key}`}
              onClick={() => nav(c.to)}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group text-left"
            >
              <Panel clip className="p-6 h-full hover:border-cyan transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-cyan text-xs">{c.tag}</span>
                  <span className="text-cyan opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
                <h3 className="font-display font-bold text-xl mt-6 text-white">
                  {t(`landing.card.${c.key}`)}
                </h3>
                <p className="text-[#a1a1aa] text-sm mt-2">{t(`landing.card.${c.key}Desc`)}</p>
              </Panel>
            </motion.button>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="mt-16">
        <Overline>{t("landing.how")}</Overline>
        <div className="grid md:grid-cols-3 gap-px bg-[#27272a] border border-[#27272a] mt-5">
          {["landing.step1", "landing.step2", "landing.step3"].map((k, i) => (
            <div key={k} className="bg-void p-6">
              <span className="font-display font-black text-4xl text-cyan/25">{i + 1}</span>
              <p className="text-[#d4d4d8] text-sm mt-3">{t(k)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
