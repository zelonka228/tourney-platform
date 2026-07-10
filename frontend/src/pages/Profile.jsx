import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams } from "../lib/api";
import { avgRating, DISCIPLINES } from "../lib/demo";
import { Btn, Overline, Panel, Stat } from "../components/arena";

export function Profile() {
  const { t } = useI18n();
  const [sel, setSel] = useState(null);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  if (sel === null) {
    return (
      <div className="py-10" data-testid="profile-list">
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
          {t("profile.title")}
        </h1>
        <p className="text-[#a1a1aa] mt-2">{t("profile.sub")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {teams.map((team, i) => {
            // Рейтинг — середнє лише основного складу, підстави не враховуються.
            const r = avgRating(team.discipline, team.players.filter((p) => !p.isSubstitute).map((p) => p.rank));
            return (
              <motion.button
                key={team.id}
                data-testid={`team-card-${i}`}
                onClick={() => setSel(i)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="text-left"
              >
                <Panel clip className="p-5 flex items-center gap-4 hover:border-cyan transition-colors">
                  <Logo logo={team.logo} className="w-12 h-12" />
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-white truncate">{team.name}</h3>
                    <p className="text-xs font-mono text-[#a1a1aa] mt-1">
                      {team.discipline} · {r.label} {t(`unit.${r.unitKey}`)}
                    </p>
                  </div>
                </Panel>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  const team = teams[sel];
  const mainPlayers = team.players.filter((p) => !p.isSubstitute);
  const rating = avgRating(team.discipline, mainPlayers.map((p) => p.rank));
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);

  return (
    <div className="py-10" data-testid="profile-detail">
      <div className="flex items-center justify-between">
        <Btn size="sm" variant="ghost" data-testid="profile-back-btn" onClick={() => setSel(null)}>
          {t("profile.back")}
        </Btn>
        <Link to={`/team/${team.id}`} className="text-cyan text-sm font-mono hover:underline">
          {t("profile.edit")}
        </Link>
      </div>

      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-6">
        {team.name}
      </h1>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 mt-8 items-start">
        <Panel clip>
          <div className="flex items-center gap-4 p-5 border-b border-[#27272a]">
            <Logo logo={team.logo} className="w-14 h-14" />
            <div>
              <div className="font-display font-bold text-lg text-white">{team.name}</div>
              <div className="text-xs font-mono text-[#a1a1aa] mt-1">
                {team.discipline} · {unit}: <span className="text-cyan">{rating.label}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#27272a]">
            <Stat value={team.winrate ?? "—"} label={t("profile.winrate")} />
            <Stat value={team.streak ?? "—"} label={t("profile.streak")} accent="volt" />
            <Stat value={team.tournaments} label={t("profile.tournaments")} />
            <Stat value={team.best ?? "—"} label={t("profile.best")} accent="volt" />
          </div>
          <div className="p-5">
            <Overline>{t("profile.roster")} · {unit}</Overline>
            <div className="mt-3 divide-y divide-[#27272a]/60">
              {mainPlayers.map((p, i) => (
                <PlayerRow key={p.id ?? `${p.nick}-${i}`} p={p} />
              ))}
            </div>
            {team.players.some((p) => p.isSubstitute) && (
              <>
                <Overline className="mt-4">{t("profile.subs")}</Overline>
                <div className="mt-3 divide-y divide-[#27272a]/60">
                  {team.players
                    .filter((p) => p.isSubstitute)
                    .map((p, i) => (
                      <PlayerRow key={p.id ?? `sub-${p.nick}-${i}`} p={p} />
                    ))}
                </div>
              </>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel clip className="p-6">
            <Overline>{t("profile.rating")}</Overline>
            <div className="font-mono text-5xl text-cyan mt-4">{rating.label}</div>
            <div className="overline mt-1">{unit} · {mainPlayers.length} {t("profile.players")}</div>
            <p className="text-[#a1a1aa] text-sm mt-4">{t("profile.ratingDesc")}</p>
          </Panel>
          <Panel clip className="p-6">
            <Overline>{t("profile.rarity")}</Overline>
            <div className="flex gap-2 mt-4">
              {["Common", "Rare", "Epic", "Legendary"].map((tier, i) => (
                <span
                  key={tier}
                  className={`px-3 py-1 text-xs font-mono border rounded-sm ${
                    i === 2 ? "border-volt text-volt bg-volt/10" : "border-[#27272a] text-[#52525b]"
                  }`}
                >
                  {tier}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ p }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-1.5 h-1.5 bg-cyan/60 rotate-45 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm text-white truncate">{p.nick}</div>
        <div className="text-[11px] font-mono text-[#a1a1aa]">{p.role}</div>
      </div>
      <span className="ml-auto font-mono text-sm text-cyan">{p.rank}</span>
    </div>
  );
}

function Logo({ logo, className }) {
  return (
    <div className={`shrink-0 border border-[#27272a] bg-void grid place-items-center overflow-hidden ${className}`}>
      {logo ? (
        <img src={logo} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="w-3 h-3 border border-cyan/40 rotate-45" />
      )}
    </div>
  );
}
