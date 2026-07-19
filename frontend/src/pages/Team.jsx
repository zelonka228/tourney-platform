import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { getTeam, createTeam, updateTeam } from "../lib/api";
import {
  DISCIPLINE_LIST,
  DISCIPLINES,
  ROLES_BY_GAME,
  VALORANT_RANKS,
  avgRating,
} from "../lib/demo";
import { readCroppedImage } from "../lib/cropImage";
import { Btn, Field, Input, Overline, Panel, Select } from "../components/arena";

const DEFAULT_RANK = { CS2: 1800, "Dota 2": 3000, Valorant: "Diamond" };
const DEFAULT_NAME = "Night Wolves";
const DEFAULT_DISCIPLINE = "CS2";
const defaultPlayers = () => [
  { nick: "s1mple_ua", role: "AWPer", rank: 2510 },
  { nick: "blaze", role: "Entry", rank: 2180 },
  { nick: "anchor", role: "Support", rank: 1990 },
  { nick: "maestro", role: "IGL", rank: 2070 },
  { nick: "ghost", role: "Lurker", rank: 2240 },
];
const defaultSubs = () => [{ nick: "spare1", role: "Support", rank: 1800 }];
const fromDbRank = (d, rank) => (DISCIPLINES[d].kind === "rank" ? rank : Number(rank));
const LINK_HINT_KEY = { CS2: "team.link.cs2", Valorant: "team.link.valorant" };
const RARITY_TIERS = ["Common", "Rare", "Epic", "Legendary"];

export function Team() {
  const nav = useNavigate();
  const { id } = useParams();
  const { t } = useI18n();
  const { isAdmin, canManageContent } = useAuth();
  const [discipline, setDiscipline] = useState(DEFAULT_DISCIPLINE);
  const [name, setName] = useState(DEFAULT_NAME);
  const [logo, setLogo] = useState(null);
  const [rarityOverride, setRarityOverride] = useState("");
  const [logoError, setLogoError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [players, setPlayers] = useState(defaultPlayers);
  const [subs, setSubs] = useState(defaultSubs);
  const roles = ROLES_BY_GAME[discipline];
  const def = DISCIPLINES[discipline];

  // Якщо в URL є id — вантажимо реальну команду. Якщо id зник (перехід
  // /team/:id → /team без розмонтування компонента) — скидаємо форму до
  // дефолтів, інакше save() без id створив би дублікат зі старими даними.
  // Якщо id є, але команди з таким id не існує — окремий notFound-стан
  // замість тихого показу застарілих/дефолтних даних.
  useEffect(() => {
    setNotFound(false);
    if (!id) {
      setName(DEFAULT_NAME);
      setDiscipline(DEFAULT_DISCIPLINE);
      setLogo(null);
      setRarityOverride("");
      setPlayers(defaultPlayers());
      setSubs(defaultSubs());
      return;
    }
    getTeam(id).then((tm) => {
      if (!tm) {
        setNotFound(true);
        return;
      }
      setName(tm.name);
      setDiscipline(tm.discipline);
      setLogo(tm.logo ?? null);
      setRarityOverride(tm.rarityOverride ?? "");
      const map = (sub) =>
        tm.players
          .filter((p) => !!p.isSubstitute === sub)
          .map((p) => ({
            nick: p.nick,
            role: p.role,
            rank: fromDbRank(tm.discipline, p.rank),
            id: p.id,
            externalRef: p.externalRef ?? "",
          }));
      setPlayers(map(false));
      setSubs(map(true));
    });
  }, [id]);

  function changeDiscipline(d) {
    const nr = ROLES_BY_GAME[d];
    const isRank = DISCIPLINES[d].kind === "rank";
    const valid = (v) => (isRank ? VALORANT_RANKS.includes(v) : typeof v === "number");
    const remap = (list) =>
      list.map((p, i) => ({
        ...p,
        role: nr.includes(p.role) ? p.role : nr[i % nr.length],
        rank: valid(p.rank) ? p.rank : DEFAULT_RANK[d],
      }));
    setPlayers(remap);
    setSubs(remap);
    setDiscipline(d);
  }

  const teamRating = avgRating(
    discipline,
    players.map((p) => p.rank)
  );

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    try {
      setLogo(await readCroppedImage(file));
    } catch (err) {
      setLogoError(err.message);
    }
  }

  // Навігація лише після підтвердженого успіху — на реальній помилці бекенду
  // (напр. порожня назва) показуємо повідомлення замість тихого переходу на
  // /profile, ніби все зберіглось.
  async function save() {
    setSaveError(null);
    const payload = {
      name,
      discipline,
      logo,
      ...(isAdmin ? { rarityOverride: rarityOverride || null } : {}),
      players: [
        ...players.map((p) => ({
          nick: p.nick,
          role: p.role,
          rank: String(p.rank),
          isSubstitute: false,
          externalRef: p.externalRef || null,
        })),
        ...subs.map((p) => ({
          nick: p.nick,
          role: p.role,
          rank: String(p.rank),
          isSubstitute: true,
          externalRef: p.externalRef || null,
        })),
      ],
    };
    try {
      if (id) await updateTeam(id, payload);
      else await createTeam(payload);
      nav("/profile");
    } catch (err) {
      setSaveError(err.message);
    }
  }

  const rankField = (p, onChange) =>
    def.kind === "rank" ? (
      <Select value={p.rank} onChange={(e) => onChange(e.target.value)}>
        {VALORANT_RANKS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
    ) : (
      <Input type="number" value={p.rank} onChange={(e) => onChange(+e.target.value)} />
    );

  const editor = (list, setList, max, addLabel, testid) => (
    <div data-testid={testid}>
      <div className="grid grid-cols-[24px_1fr_1fr_110px_36px] gap-2 items-center mb-2">
        {["#", t("team.col.nick"), t("team.col.role"), t(`unit.${def.unitKey}`), ""].map((h, i) => (
          <span key={i} className="overline">
            {h}
          </span>
        ))}
      </div>
      {list.map((p, i) => (
        <div className="mb-2" key={i}>
          <div className="grid grid-cols-[24px_1fr_1fr_110px_36px] gap-2 items-center">
            <span className="font-mono text-xs text-[#52525b]">{i + 1}</span>
            <Input
              value={p.nick}
              onChange={(e) =>
                setList((l) => l.map((x, idx) => (idx === i ? { ...x, nick: e.target.value } : x)))
              }
            />
            <Select
              value={p.role}
              onChange={(e) =>
                setList((l) => l.map((x, idx) => (idx === i ? { ...x, role: e.target.value } : x)))
              }
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            {rankField(p, (v) =>
              setList((l) => l.map((x, idx) => (idx === i ? { ...x, rank: v } : x)))
            )}
            <button
              onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}
              className="h-[42px] border border-[#27272a] rounded-sm text-[#a1a1aa] hover:border-[#ff0055] hover:text-[#ff0055] transition-colors"
            >
              ×
            </button>
          </div>
          {LINK_HINT_KEY[discipline] && (
            <input
              type="text"
              value={p.externalRef ?? ""}
              data-testid={`player-external-ref-${i}`}
              onChange={(e) =>
                setList((l) =>
                  l.map((x, idx) => (idx === i ? { ...x, externalRef: e.target.value } : x))
                )
              }
              placeholder={t(LINK_HINT_KEY[discipline])}
              className="w-[calc(100%-58px)] ml-[32px] mt-1 bg-void border border-[#27272a] rounded-sm px-2 py-1 text-xs text-[#a1a1aa] placeholder:text-[#3f3f46] focus:outline-none focus:border-cyan transition-colors"
            />
          )}
        </div>
      ))}
      <Btn
        size="sm"
        variant="ghost"
        disabled={list.length >= max}
        className="mt-2"
        onClick={() =>
          setList((l) => [...l, { nick: "", role: roles[0], rank: DEFAULT_RANK[discipline] }])
        }
      >
        {addLabel}
      </Btn>
    </div>
  );

  if (notFound) {
    return (
      <div className="py-10" data-testid="team-not-found">
        <Overline className="text-cyan">// {t("nav.team")}</Overline>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
          {t("team.title")}
        </h1>
        <p className="text-[#a1a1aa] mt-4">
          {t("team.notFound")}{" "}
          <Link to="/profile" className="text-cyan hover:underline">
            {t("team.allTeams")}
          </Link>
        </p>
      </div>
    );
  }

  if (!canManageContent) {
    return (
      <div className="py-10" data-testid="team-admin-only">
        <Overline className="text-cyan">// {t("nav.team")}</Overline>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
          {t("team.title")}
        </h1>
        <Panel clip className="p-6 mt-8 max-w-md">
          <p className="text-[#a1a1aa] text-sm">{t("auth.contentManagerOnly")}</p>
          <Link to="/login" className="block mt-4 text-cyan text-sm hover:underline">
            {t("auth.signInToEditContent")}
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="py-10" data-testid="team-page">
      <Overline className="text-cyan">// {t("nav.team")}</Overline>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter text-white mt-3">
        {t("team.title")}
      </h1>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6 mt-8 items-start">
        <Panel clip className="p-5">
          <Overline>{t("team.logo")}</Overline>
          <div className="mt-3 aspect-square border border-[#27272a] bg-void grid place-items-center overflow-hidden">
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-8 h-8 border border-cyan/30 rotate-45" />
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            id="logo-input"
            className="sr-only"
            onChange={handleLogoChange}
          />
          <label
            htmlFor="logo-input"
            data-testid="team-logo-upload"
            className="mt-3 block text-center px-4 py-2 text-xs font-sans uppercase tracking-wider border border-[#3f3f46] rounded-sm cursor-pointer hover:border-cyan hover:text-cyan transition-colors"
          >
            {logo ? t("team.change") : t("team.upload")}
          </label>
          {logo && (
            <button
              onClick={() => setLogo(null)}
              className="mt-2 w-full text-center px-4 py-2 text-xs uppercase tracking-wider text-[#ff0055] border border-[#ff0055]/30 rounded-sm hover:bg-[#ff0055]/10 transition-colors"
            >
              {t("team.removeLogo")}
            </button>
          )}
          {logoError && <p className="text-[#ff0055] text-xs mt-2">{logoError}</p>}

          {isAdmin && (
            <div className="mt-5 pt-5 border-t border-[#27272a]">
              <Overline>{t("team.rarity.manual")}</Overline>
              <Select
                className="mt-3"
                data-testid="team-rarity-override"
                value={rarityOverride}
                onChange={(e) => setRarityOverride(e.target.value)}
              >
                <option value="">{t("team.rarity.auto")}</option>
                {RARITY_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Panel>

        <Panel clip className="p-6">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label={t("team.name")}>
              <Input
                value={name}
                data-testid="team-name-input"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={t("team.discipline")}>
              <Select
                value={discipline}
                data-testid="team-discipline-select"
                onChange={(e) => changeDiscipline(e.target.value)}
              >
                {DISCIPLINE_LIST.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-4 p-4 mb-6 border border-cyan/30 bg-cyan/5 rounded-sm">
            <div>
              <div className="overline text-cyan">
                {t("team.avg")} {t(`unit.${teamRating.unitKey}`)}
              </div>
              <div className="font-mono text-3xl text-cyan mt-1">{teamRating.label}</div>
            </div>
            <span className="ml-auto text-xs font-mono text-[#a1a1aa]">
              {players.length} {t("team.mainPlayers")}
            </span>
          </div>

          <h2 className="font-display font-bold text-lg text-white mb-3">{t("team.main")}</h2>
          {editor(players, setPlayers, 7, t("team.addPlayer"), "team-main-editor")}

          <h2 className="font-display font-bold text-lg text-white mt-8 mb-3">{t("team.subs")}</h2>
          {editor(subs, setSubs, 5, t("team.addSub"), "team-subs-editor")}

          <div className="mt-8">
            <Btn variant="primary" data-testid="team-save-btn" onClick={save}>
              {t("team.save")}
            </Btn>
            {saveError && <p className="text-[#ff0055] text-sm mt-3">{saveError}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
