import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { getTeams, createTournament } from "../lib/api";
import {
  bracketPlan,
  BEST_OF,
  winTarget,
  DISCIPLINE_LIST,
  avgRating,
  effectivePlayerRank,
} from "../lib/demo";
import { Btn, Field, Input, Overline, Panel, Select } from "../components/arena";

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Порядок teamIds = порядок посіву (перший — seed 1). Рейтинг рахується
// лише по основному складу — запасні (isSubstitute) не повинні впливати
// на посів "За рейтингом".
function seedTeamIds(ids, allTeams, seedType) {
  if (seedType === "random") return shuffled(ids);
  if (seedType === "rating") {
    const byId = new Map(allTeams.map((t) => [t.id, t]));
    const ratingOf = (id) => {
      const t = byId.get(id);
      return (
        avgRating(
          t.discipline,
          t.players.filter((p) => !p.isSubstitute).map((p) => effectivePlayerRank(t.discipline, p))
        ).value ?? -Infinity
      );
    };
    return [...ids].sort((a, b) => ratingOf(b) - ratingOf(a));
  }
  return ids;
}

export function Create() {
  const nav = useNavigate();
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [name, setName] = useState("LAN Cup");
  const [bracket, setBracket] = useState("single");
  const [bo, setBo] = useState(3);
  const [discipline, setDiscipline] = useState("CS2");
  const [date, setDate] = useState("2026-07-12");
  const [seedType, setSeedType] = useState("rating");
  const [allTeams, setAllTeams] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTeams().then(setAllTeams);
  }, []);

  const changeDiscipline = (d) => {
    setDiscipline(d);
    setSelectedIds([]);
  };
  const toggleTeam = (id) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const teamsInDiscipline = allTeams.filter((tm) => tm.discipline === discipline);
  const visibleTeams = teamsInDiscipline.filter((tm) =>
    tm.name.toLowerCase().includes(teamQuery.trim().toLowerCase())
  );
  const isDouble = bracket === "double";
  const plan = bracketPlan(Math.max(selectedIds.length, 1));
  const canSubmit = !isDouble && selectedIds.length >= 2 && name.trim() !== "" && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTournament({
        name,
        discipline,
        bracketType: isDouble ? "double" : "single",
        matchFormat: bo,
        teamIds: seedTeamIds(selectedIds, allTeams, seedType),
        date,
        // Manual seeding: register the teams but don't lock in a bracket yet —
        // the admin reorders them on the tournament page and generates the
        // bracket explicitly once satisfied (see Tournament.jsx "teams" tab).
        generateBracket: seedType !== "manual",
      });
      if (!created?.id) throw new Error("Failed.");
      nav(`/tournament/${created.id}`);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="py-10" data-testid="create-admin-only">
        <Overline className="text-cyan">// {t("nav.create")}</Overline>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
          {t("create.title")}
        </h1>
        <Panel clip className="p-6 mt-8 max-w-md">
          <p className="text-[#a1a1aa] text-sm">{t("auth.adminOnly")}</p>
          <Link to="/login" className="block mt-4 text-cyan text-sm hover:underline">
            {t("auth.signInToEdit")}
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="py-10" data-testid="create-page">
      <Overline className="text-cyan">// {t("nav.create")}</Overline>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
        {t("create.title")}
      </h1>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-8 items-start">
        <Panel clip className="p-6">
          <Field label={t("create.name")}>
            <Input
              value={name}
              data-testid="create-name-input"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label={t("create.bracket")}>
              <Select
                value={bracket}
                data-testid="create-bracket-select"
                onChange={(e) => setBracket(e.target.value)}
              >
                <option value="single">{t("create.single")}</option>
                <option value="double">{t("create.double")}</option>
              </Select>
              {isDouble && (
                <span className="block mt-2 text-xs text-[#ff0055]">{t("create.doubleHint")}</span>
              )}
            </Field>
            <Field label={t("create.format")}>
              <Select
                value={bo}
                data-testid="create-bo-select"
                onChange={(e) => setBo(+e.target.value)}
              >
                {BEST_OF.map((n) => (
                  <option key={n} value={n}>
                    BO{n} — {t("create.winTo", { n: winTarget(n) })}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label={t("create.discipline")}>
              <Select
                value={discipline}
                data-testid="create-discipline-select"
                onChange={(e) => changeDiscipline(e.target.value)}
              >
                {DISCIPLINE_LIST.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("create.date")}>
              <Input
                type="date"
                value={date}
                data-testid="create-date-input"
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("create.seed")}>
            <Select
              value={seedType}
              data-testid="create-seed-select"
              onChange={(e) => setSeedType(e.target.value)}
            >
              <option value="random">{t("create.seed.random")}</option>
              <option value="rating">{t("create.seed.rating")}</option>
              <option value="manual">{t("create.seed.manual")}</option>
            </Select>
            {seedType === "manual" && (
              <span className="block mt-2 text-xs text-[#a1a1aa]">
                {t("create.seed.manualHint")}
              </span>
            )}
          </Field>

          <div className="mt-2">
            <Overline>
              {t("create.participants")} ({discipline})
            </Overline>
            {teamsInDiscipline.length === 0 ? (
              <p className="text-xs text-[#ff0055] mt-3">{t("create.noTeams")}</p>
            ) : (
              <>
                {teamsInDiscipline.length > 5 && (
                  <Input
                    value={teamQuery}
                    data-testid="create-team-search"
                    placeholder={t("create.teamSearch")}
                    onChange={(e) => setTeamQuery(e.target.value)}
                    className="mt-3"
                  />
                )}
                {visibleTeams.length === 0 && (
                  <p className="text-xs text-[#52525b] mt-3">{t("create.noMatch")}</p>
                )}
                <div className="grid sm:grid-cols-2 gap-2 mt-3" data-testid="create-team-picker">
                  {visibleTeams.map((tm) => {
                    const on = selectedIds.includes(tm.id);
                    return (
                      <button
                        key={tm.id}
                        data-testid={`create-team-${tm.id}`}
                        onClick={() => toggleTeam(tm.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 border rounded-sm text-left text-sm transition-colors ${
                          on
                            ? "border-cyan bg-cyan/10 text-white ring-1 ring-cyan"
                            : "border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rotate-45 shrink-0 ${on ? "bg-cyan" : "border border-[#3f3f46]"}`}
                        />
                        {tm.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="text-[#ff0055] text-sm mt-4" data-testid="create-error">
              {error}
            </p>
          )}

          <div className="mt-6">
            <Btn
              variant="primary"
              data-testid="create-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting
                ? t("create.submitting")
                : t(seedType === "manual" ? "create.submit.manual" : "create.submit")}
            </Btn>
          </div>
        </Panel>

        <motion.div layout>
          <Panel clip className="p-6 sticky top-24">
            <Overline className="text-cyan">{t("create.preview")}</Overline>
            <dl className="mt-5 space-y-3 text-sm font-mono">
              <Row k={t("create.p.bracket")} v={t(`create.${bracket}`).split(" (")[0]} />
              <Row k={t("create.p.format")} v={`BO${bo}`} />
              <Row k={t("create.p.selected")} v={selectedIds.length} />
              <Row k={t("create.p.rounds")} v={plan.rounds} />
              <Row k={t("create.p.matches")} v={plan.matches} />
            </dl>
            <div className="mt-5 pt-4 border-t border-[#27272a] text-xs text-[#a1a1aa]">
              {selectedIds.length < 2
                ? t("create.min2")
                : plan.byes === 0
                  ? t("create.pow2", { n: selectedIds.length })
                  : t("create.byes", { n: selectedIds.length, full: plan.full, byes: plan.byes })}
            </div>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[#a1a1aa] uppercase text-[11px] tracking-widest">{k}</dt>
      <dd className="text-cyan">{v}</dd>
    </div>
  );
}
