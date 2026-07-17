import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getTeams } from "../lib/api";
import { socket } from "../lib/socket";
import { DISCIPLINE_LIST, RARITY_TIERS, teamRarity } from "../lib/demo";
import { Overline, Panel, Btn, Input, Select } from "../components/arena";
import { TeamCard } from "../components/TeamCard";
import { downloadTeamCard } from "../lib/exportCard";
import { openedPacksCount, onPacksChanged } from "../lib/openedPacks";
import { Skeleton } from "../components/Skeleton";
import { ScaleToFit } from "../components/ScaleToFit";

const CONFETTI_COLORS = ["#00F0FF", "#DFFF00", "#ffd23f", "#e94bd6"];

// Разове конфеті при повній колекції — падає зверху вниз один раз при
// монтуванні банера (не циклічне), кожна смужка своїм кольором/кутом/
// затримкою для органічності. Проста CSS/Framer-Motion версія, без нової
// залежності на кшталт canvas-confetti — досить для одноразового ефекту.
function CollectionConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.4,
        duration: 1.4 + Math.random() * 0.8,
        rotate: (Math.random() * 2 - 1) * 260,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 220, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: 6,
            height: 10,
            background: p.color,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

// Кожна картка в галереї має власний ref/стан завантаження — на відміну від
// /profile (де відкрита лише одна команда за раз), тут одночасно на екрані
// багато TeamCard, і спільний cardRef/cardSaving переплутав би, яку саме
// картку зберігати.
function CollectionCard({ team }) {
  const { t } = useI18n();
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);

  async function handleDownload() {
    setSaving(true);
    try {
      await downloadTeamCard(cardRef.current, team.name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel clip className="p-6 flex flex-col items-center gap-4">
      <Overline className="self-start w-full truncate">{team.name}</Overline>
      <ScaleToFit width={320}>
        <TeamCard ref={cardRef} team={team} />
      </ScaleToFit>
      <Btn variant="primary" disabled={saving} onClick={handleDownload}>
        {saving ? "…" : t("profile.card.download")}
      </Btn>
    </Panel>
  );
}

export function Collection() {
  const { t } = useI18n();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  // Сеттер лише щоб примусити React перерендерити компонент — сам прогрес
  // читається напряму з localStorage при кожному рендері нижче (openedPacksCount),
  // тримати число в стейті окремо не потрібно.
  const [, setOpenedTick] = useState(0);

  useEffect(() => {
    getTeams().then((data) => {
      setTeams(data);
      setLoading(false);
    });
    const onChanged = () => getTeams().then(setTeams);
    socket.on("teams:changed", onChanged);
    return () => socket.off("teams:changed", onChanged);
  }, []);

  useEffect(() => onPacksChanged(() => setOpenedTick((v) => v + 1)), []);

  // Легендарні йдуть першими — галерея одразу читається як "від найріднішого
  // до найзвичайнішого" (RARITY_TIERS = [Common, Rare, Epic, Legendary],
  // тож більший індекс = вища рідкість).
  const filtered = teams
    .filter((team) => team.name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((team) => disciplineFilter === "all" || team.discipline === disciplineFilter)
    .filter((team) => rarityFilter === "all" || teamRarity(team) === rarityFilter)
    .sort((a, b) => RARITY_TIERS.indexOf(teamRarity(b)) - RARITY_TIERS.indexOf(teamRarity(a)));

  const opened = openedPacksCount(teams.map((tm) => tm.id));
  const total = teams.length;
  const progressPct = total > 0 ? Math.round((opened / total) * 100) : 0;

  return (
    <div className="py-10" data-testid="collection-page">
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white">
        {t("collection.title")}
      </h1>
      <p className="text-[#a1a1aa] mt-2">{t("collection.sub")}</p>

      {total > 0 && (
        <div className="max-w-sm mt-5" data-testid="collection-progress">
          <div className="flex justify-between text-xs font-mono text-[#a1a1aa] mb-1.5">
            <span>{t("collection.progress")}</span>
            <span className="text-cyan">
              {opened}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#27272a] overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {total > 0 && opened === total && (
        <div className="relative max-w-sm mt-4 overflow-hidden" data-testid="collection-complete-banner">
          <div className="bg-surface/80 border border-volt/50 clip-corner px-4 py-3">
            <p className="text-volt font-mono text-sm text-center">{t("collection.complete")}</p>
          </div>
          <CollectionConfetti />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        {teams.length > 5 && (
          <Input
            value={query}
            data-testid="collection-search"
            placeholder={t("hall.search")}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
        )}
        <Select
          value={disciplineFilter}
          data-testid="collection-discipline-filter"
          onChange={(e) => setDisciplineFilter(e.target.value)}
          className="max-w-[200px]"
        >
          <option value="all">{t("hall.all")}</option>
          {DISCIPLINE_LIST.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select
          value={rarityFilter}
          data-testid="collection-rarity-filter"
          onChange={(e) => setRarityFilter(e.target.value)}
          className="max-w-[200px]"
        >
          <option value="all">{t("hall.all")}</option>
          {RARITY_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8 mt-8 justify-items-center">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-4 p-6 w-full max-w-[320px]">
              <Skeleton className="h-4 w-32 self-start" />
              <Skeleton className="w-[320px] h-[600px] max-w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[#71717a] mt-10">{t("collection.empty")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8 mt-8 justify-items-center">
          {filtered.map((team) => (
            <CollectionCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
