// Портретна RPG-картка команди 320×600 з переднім/заднім боком (перевертання
// по кліку), анімацією появи "з крихітної та обертом" (Hearthstone-style) та
// оформленням заду під конкретну дисципліну (docs/04-rpg-card-spec.md).
// Задум і всі числові координати — з підтверджених макетів у
// .superpowers/brainstorm (final-full-demo-v5.html для CS2, push-quality-v6.html
// для Dota-самоцвіту), перенесені сюди 1:1 де це можливо.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  avgRating,
  effectivePlayerRank,
  effectivePlayerNick,
  teamRarity,
  DISCIPLINES,
} from "../lib/demo";
import ak47Url from "../assets/ak47.png";
import spikeRushUrl from "../assets/spikerush.png";
import duelistUrl from "../assets/duelist.png";
import controllerUrl from "../assets/controller.png";
import initiatorUrl from "../assets/initiator.png";
import sentinelUrl from "../assets/sentinel.png";
import blastpackUrl from "../assets/blastpack.png";
import curveballUrl from "../assets/curveball.png";
import cybercageUrl from "../assets/cybercage.png";
import healingorbUrl from "../assets/healingorb.png";

const TIER_VARS = {
  Common: {
    "--tier-color": "#a1a1aa",
    "--tier-glow": "rgba(161,161,170,0.18)",
    "--tier-width": "2px",
    "--tier-grain": "0.015",
  },
  Rare: {
    "--tier-color": "#4b6bff",
    "--tier-glow": "rgba(75,107,255,0.4)",
    "--tier-width": "2.2px",
    "--tier-grain": "0.02",
  },
  Epic: {
    "--tier-color": "#e94bd6",
    "--tier-glow": "rgba(233,75,214,0.45)",
    "--tier-width": "2.5px",
    "--tier-grain": "0.025",
  },
  Legendary: {
    "--tier-color": "#ffd23f",
    "--tier-glow": "rgba(255,178,50,0.5)",
    "--tier-width": "3px",
    "--tier-grain": "0.035",
  },
};

const GEN_TRANSITION = "transform 1.1s cubic-bezier(.16,1.2,.3,1), opacity 0.4s ease";
const FLIP_TRANSITION = "transform 0.8s cubic-bezier(.2,.8,.2,1)";

const uid = (team) => String(team.id ?? team.name).replace(/[^a-zA-Z0-9]/g, "");

// forwardRef — html-to-image потребує пряме посилання на DOM-вузол активної
// (видимої) сторони картки, а не на обгортку з 3D-трансформацією.
export const TeamCard = forwardRef(function TeamCard({ team }, ref) {
  const { t } = useI18n();
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const [generated, setGenerated] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [entered, setEntered] = useState(false);
  const [transition, setTransition] = useState(GEN_TRANSITION);

  useImperativeHandle(ref, () => (flipped ? backRef.current : frontRef.current), [flipped]);

  useEffect(() => {
    if (!generated) return;
    // Подвійний rAF — щоб браузер встиг зафіксувати стартовий "крихітний"
    // стан у DOM перед тим, як ми поставимо transition і кінцевий transform,
    // інакше CSS-перехід не запуститься (стрибне одразу в кінцевий стан).
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, [generated]);

  const mainPlayers = team.players.filter((p) => !p.isSubstitute);
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);
  const rating = avgRating(
    team.discipline,
    mainPlayers.map((p) => effectivePlayerRank(team.discipline, p))
  );
  const rarity = teamRarity(team);
  const tierVars = TIER_VARS[rarity];
  const Front = DISCIPLINE_FRONT[team.discipline] ?? CardFront;
  const Back = DISCIPLINE_BACK[team.discipline] ?? GenericBack;

  function handleFlip() {
    if (!entered) return;
    setTransition(FLIP_TRANSITION);
    setFlipped((v) => !v);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ perspective: "1200px", width: 320, height: 600, position: "relative" }}>
        {!generated && (
          <button
            type="button"
            data-testid="team-card-generate"
            onClick={() => setGenerated(true)}
            className="absolute inset-0 z-10 border-2 border-dashed border-[#3f3f46] grid place-items-center text-[#a1a1aa] font-mono text-xs uppercase tracking-widest hover:border-cyan hover:text-cyan transition-colors bg-void"
          >
            {t("profile.card.generate")}
          </button>
        )}
        <div
          onClick={handleFlip}
          data-testid="team-card-flip"
          style={{
            ...tierVars,
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transition,
            transform: entered
              ? `scale(1) rotateY(${flipped ? 180 : 0}deg)`
              : "scale(0.05) rotateY(0deg)",
            opacity: entered ? 1 : 0,
            cursor: generated ? "pointer" : "default",
          }}
        >
          <Front
            ref={frontRef}
            team={team}
            rarity={rarity}
            rating={rating}
            unit={unit}
            mainPlayers={mainPlayers}
          />
          <Back ref={backRef} team={team} rarity={rarity} />
        </div>
      </div>
      {generated && (
        <p className="text-[11px] font-mono text-[#52525b] uppercase tracking-widest">
          {t("profile.card.flipHint")}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Спільна рамка з тонкими кутовими скобами та ромбовими шипами по кутах —
// однакова для переду й усіх задів, лише колір іде з --tier-color. Винесена
// окремо, щоб не дублювати одну й ту саму геометрію в 3 місцях.
function FrameChrome() {
  return (
    <>
      <rect x="9" y="9" width="302" height="582" fill="none" stroke="var(--tier-color)" strokeWidth="var(--tier-width)" />
      <rect x="18" y="18" width="284" height="564" fill="none" stroke="var(--tier-color)" strokeWidth="1" strokeOpacity="0.4" />
      <g stroke="var(--tier-color)" strokeWidth="2.4" fill="none">
        <path d="M9,46 L9,9 L46,9" />
        <path d="M311,46 L311,9 L274,9" />
        <path d="M9,554 L9,591 L46,591" />
        <path d="M311,554 L311,591 L274,591" />
      </g>
      <g fill="var(--tier-color)">
        <rect x="4.5" y="4.5" width="9" height="9" transform="rotate(45 9 9)" />
        <rect x="306.5" y="4.5" width="9" height="9" transform="rotate(45 311 9)" />
        <rect x="4.5" y="586.5" width="9" height="9" transform="rotate(45 9 591)" />
        <rect x="306.5" y="586.5" width="9" height="9" transform="rotate(45 311 591)" />
      </g>
      <g fill="var(--tier-color)">
        <circle cx="160" cy="12" r="2.6" />
        <circle cx="160" cy="588" r="2.6" />
      </g>
    </>
  );
}

const faceStyle = (extra) => ({
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  borderRadius: 6,
  overflow: "hidden",
  fontFamily: "'IBM Plex Sans', sans-serif",
  ...extra,
});

// ---------------------------------------------------------------------------
const CardFront = forwardRef(function CardFront({ team, rarity, rating, unit, mainPlayers }, ref) {
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ background: "#0c0c0e" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`fjClip-${id}`}>
            <circle cx="160" cy="130" r="46" />
          </clipPath>
        </defs>
        <rect width="320" height="600" fill="#0c0c0e" />
        <FrameChrome />
        <polygon points="40,30 280,30 262,58 58,58" fill="#100e08" stroke="var(--tier-color)" strokeWidth="2" />
        <circle cx="160" cy="130" r="46" fill="#09090B" stroke="var(--tier-color)" strokeWidth="3.5" />
        <g clipPath={`url(#fjClip-${id})`}>
          {team.logo ? (
            <image href={team.logo} x="114" y="84" width="92" height="92" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="114" y="84" width="92" height="92" fill="#09090B" />
          )}
        </g>
        {!team.logo && (
          <rect x="146" y="116" width="28" height="28" fill="none" stroke="var(--tier-color)" strokeOpacity="0.5" strokeWidth="2" transform="rotate(45 160 130)" />
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          top: 36,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "'Unbounded', sans-serif",
          fontWeight: 800,
          fontSize: 16,
          color: "#f4f4f5",
          padding: "0 62px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {team.name.toUpperCase()}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 196, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: 34,
            color: "#00f0ff",
            textShadow: "0 0 10px rgba(0,240,255,0.5)",
            lineHeight: 1,
          }}
        >
          {rating.label}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8a8a90", marginTop: 5 }}>
          {unit.toUpperCase()}
        </div>

        <div
          style={{
            width: "78%",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 10,
            color: "#8a8a90",
            marginTop: 20,
          }}
        >
          <span>
            WINRATE <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.winrate ?? "—"}</b>
          </span>
          <span>
            СТРІК <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.streak ?? "—"}</b>
          </span>
          <span>
            ТУРНІРІВ <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.tournaments}</b>
          </span>
        </div>

        <div style={{ width: "78%", height: 1, background: "var(--tier-color)", opacity: 0.3, marginTop: 18 }} />

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#71717a", marginTop: 14 }}>
          СКЛАД · {unit.toUpperCase()}
        </div>

        <div style={{ width: "80%", marginTop: 8 }}>
          {mainPlayers.map((p, i) => (
            <div
              key={p.id ?? `${p.nick}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "4px 0",
                borderBottom: i === mainPlayers.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <div style={{ fontFamily: "'IBM Plex Sans'", fontSize: 12, fontWeight: 600, color: "#f4f4f5", lineHeight: 1.3 }}>
                  {effectivePlayerNick(team.discipline, p)}
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans'", fontSize: 9, color: "#71717a", lineHeight: 1.3 }}>{p.role}</div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "#00f0ff" }}>
                {effectivePlayerRank(team.discipline, p)}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.2em",
            fontSize: 13,
            color: "var(--tier-color)",
          }}
        >
          {rarity.toUpperCase()}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CS2: схрещені калаші (реальний силует, CSS mask-image) на медальйоні +
// приціл-емблема "CS2" зверху.
const CS2Back = forwardRef(function CS2Back({ team }, ref) {
  const id = uid(team);
  const rifleStyle = (rotateExpr) => ({
    position: "absolute",
    left: 160,
    top: 300,
    width: 200,
    height: 58,
    transform: `translate(-50%,-50%) ${rotateExpr}`,
    WebkitMaskImage: `url(${ak47Url})`,
    maskImage: `url(${ak47Url})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    background: "var(--tier-color)",
    filter: "drop-shadow(0 0 8px var(--tier-glow))",
  });

  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "#0a0a0c" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <radialGradient id={`bjVig-${id}`} cx="50%" cy="30%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id={`bjMedallion-${id}`} cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#201a10" />
            <stop offset="70%" stopColor="#12100a" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </radialGradient>
        </defs>
        <rect width="320" height="600" fill="#0a0a0c" />
        <rect width="320" height="600" fill="var(--tier-color)" opacity="var(--tier-grain)" />
        <rect width="320" height="600" fill={`url(#bjVig-${id})`} />

        <circle cx="160" cy="68" r="34" stroke="var(--tier-color)" strokeWidth="2" fill="none" />
        <circle cx="160" cy="68" r="24" stroke="var(--tier-color)" strokeWidth="1.2" fill="none" opacity="0.5" />
        <g stroke="var(--tier-color)" strokeWidth="2">
          <line x1="160" y1="22" x2="160" y2="32" />
          <line x1="160" y1="104" x2="160" y2="114" />
          <line x1="114" y1="68" x2="124" y2="68" />
          <line x1="196" y1="68" x2="206" y2="68" />
        </g>
        <text x="160" y="68" textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="14" letterSpacing="0.5" fill="var(--tier-color)">
          CS2
        </text>

        <circle cx="160" cy="300" r="135" fill={`url(#bjMedallion-${id})`} stroke="var(--tier-color)" strokeWidth="2.8" />
        <circle cx="160" cy="300" r="123" fill="none" stroke="var(--tier-color)" strokeWidth="1.3" strokeOpacity="0.5" />

        <text x="160" y="490" textAnchor="middle" fontFamily="Unbounded, sans-serif" fontWeight="900" fontSize="22" fill="#f4f4f5">
          {team.name.toUpperCase()}
        </text>

        <FrameChrome />
      </svg>
      <div style={rifleStyle("rotate(-45deg)")} />
      <div style={rifleStyle("rotate(45deg) scaleX(-1)")} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Dota 2: гранований самоцвіт-медальйон з філігранню та лавровим мотивом —
// техніка з push-quality-v6.html (feTurbulence-зерно, шаруваті градієнти,
// bezier-філігрань), перенесена на 320×600 і прив'язана до --tier-color, щоб
// колір каменя й рамки міняв редкість, а не був завжди золотим.
const DotaBack = forwardRef(function DotaBack({ team }, ref) {
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "#0a0a0c" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <radialGradient id={`dVig-${id}`} cx="50%" cy="30%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id={`dSocket-${id}`} cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#201a10" />
            <stop offset="70%" stopColor="#12100a" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </radialGradient>
          <radialGradient id={`dGem-${id}`} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff8e8" />
            <stop offset="22%" stopColor="var(--tier-color)" />
            <stop offset="60%" stopColor="var(--tier-color)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </radialGradient>
        </defs>
        <rect width="320" height="600" fill="#0a0a0c" />
        <rect width="320" height="600" fill="var(--tier-color)" opacity="var(--tier-grain)" />
        <rect width="320" height="600" fill={`url(#dVig-${id})`} />

        {/* дрібні "жарини" для атмосфери, не заважають рамці й медальйону */}
        <g fill="var(--tier-color)">
          <circle cx="48" cy="150" r="1.4" opacity="0.6" />
          <circle cx="272" cy="180" r="1.1" opacity="0.5" />
          <circle cx="44" cy="380" r="1.3" opacity="0.5" />
          <circle cx="276" cy="400" r="1.5" opacity="0.6" />
          <circle cx="58" cy="520" r="1.2" opacity="0.5" />
          <circle cx="262" cy="530" r="1.3" opacity="0.5" />
        </g>

        {/* верхній рунічний шестикутник */}
        <polygon points="160,38 186,53 186,83 160,98 134,83 134,53" fill="#0e0d09" stroke="var(--tier-color)" strokeWidth="2" />
        <polygon points="160,46 179,57 179,79 160,90 141,79 141,57" fill="none" stroke="var(--tier-color)" strokeWidth="1.2" opacity="0.5" />
        <text x="160" y="69" textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="9.5" letterSpacing="0.3" fill="var(--tier-color)">
          DOTA 2
        </text>

        {/* філігранні завитки в проміжку між руною і медальйоном */}
        <g fill="none" stroke="var(--tier-color)" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
          <path d="M130,155 C110,146 104,128 114,110 C119,101 133,98 139,105" />
          <path d="M190,155 C210,146 216,128 206,110 C201,101 187,98 181,105" />
        </g>
        <g fill={`url(#dGem-${id})`}>
          <circle cx="114" cy="110" r="3" />
          <circle cx="206" cy="110" r="3" />
          <circle cx="139" cy="105" r="2.2" />
          <circle cx="181" cy="105" r="2.2" />
        </g>

        {/* медальйон-самоцвіт */}
        <circle cx="160" cy="300" r="135" fill={`url(#dSocket-${id})`} stroke="var(--tier-color)" strokeWidth="2.8" />
        <circle cx="160" cy="300" r="123" fill="none" stroke="var(--tier-color)" strokeWidth="1.3" strokeOpacity="0.5" />
        <circle cx="160" cy="300" r="95" fill={`url(#dGem-${id})`} />
        <ellipse cx="128" cy="262" rx="27" ry="16" fill="#fff8e8" opacity="0.5" />
        <g stroke="#000" strokeWidth="1.5" opacity="0.35">
          <line x1="160" y1="205" x2="160" y2="395" />
          <line x1="65" y1="300" x2="255" y2="300" />
          <line x1="93" y1="233" x2="227" y2="367" />
          <line x1="227" y1="233" x2="93" y2="367" />
        </g>
        <g fill={`url(#dGem-${id})`} stroke="var(--tier-color)" strokeWidth="1">
          <circle cx="255.5" cy="204.5" r="6" />
          <circle cx="64.5" cy="204.5" r="6" />
          <circle cx="255.5" cy="395.5" r="6" />
          <circle cx="64.5" cy="395.5" r="6" />
        </g>

        {/* лавровий мотив над іменем */}
        <g fill="var(--tier-color)" opacity="0.9">
          <ellipse cx="120" cy="462" rx="7" ry="3.2" transform="rotate(-25 120 462)" />
          <ellipse cx="108" cy="455" rx="7" ry="3.2" transform="rotate(-12 108 455)" />
          <ellipse cx="98" cy="450" rx="7" ry="3.2" />
          <ellipse cx="200" cy="462" rx="7" ry="3.2" transform="rotate(25 200 462)" />
          <ellipse cx="212" cy="455" rx="7" ry="3.2" transform="rotate(12 212 455)" />
          <ellipse cx="222" cy="450" rx="7" ry="3.2" />
        </g>

        <text x="160" y="490" textAnchor="middle" fontFamily="Unbounded, sans-serif" fontWeight="900" fontSize="22" fill="#f4f4f5">
          {team.name.toUpperCase()}
        </text>

        <FrameChrome />
      </svg>
    </div>
  );
});

const VALORANT_OCTAGON = "26,0 294,0 320,26 320,574 294,600 26,600 0,574 0,26";

// Восьмикутна рамка Valorant-карток (перед+зад) — інша геометрія, ніж
// FrameChrome (прямокутник з кутовими скобами) для CS2/Dota, тому окрема
// функція, а не параметризація тієї самої.
function ValorantFrame() {
  return (
    <>
      <g stroke="var(--tier-color)" strokeWidth="1.8">
        <line x1="18" y1="36" x2="18" y2="48" />
        <line x1="302" y1="36" x2="302" y2="48" />
        <line x1="18" y1="552" x2="18" y2="564" />
        <line x1="302" y1="552" x2="302" y2="564" />
      </g>
      <polygon points={VALORANT_OCTAGON} fill="none" stroke="var(--tier-color)" strokeWidth="var(--tier-width)" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Valorant-перед: восьмикутний виріз рамки, Bebas Neue (реальний UI-шрифт
// гри — Tungsten платний, Bebas Neue найближчий безкоштовний аналог) і лінія
// замість трапеції під назвою команди. Той самий контент-флоу (top:196), що
// й CardFront, — той самий клас багу з накладанням ростера вже виключено.
const ValorantFront = forwardRef(function ValorantFront(
  { team, rarity, rating, unit, mainPlayers },
  ref
) {
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ background: "#170a17" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`vfClip-${id}`}>
            <polygon points={VALORANT_OCTAGON} />
          </clipPath>
          <clipPath id={`vfPortrait-${id}`}>
            <circle cx="160" cy="130" r="46" />
          </clipPath>
        </defs>
        <g clipPath={`url(#vfClip-${id})`}>
          <rect width="320" height="600" fill="#170a17" />
        </g>
        <ValorantFrame />
        <line x1="46" y1="44" x2="274" y2="44" stroke="var(--tier-color)" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="160" cy="130" r="46" fill="#09090B" stroke="var(--tier-color)" strokeWidth="3.5" />
        <g clipPath={`url(#vfPortrait-${id})`}>
          {team.logo ? (
            <image href={team.logo} x="114" y="84" width="92" height="92" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="114" y="84" width="92" height="92" fill="#09090B" />
          )}
        </g>
        {!team.logo && (
          <rect x="146" y="116" width="28" height="28" fill="none" stroke="var(--tier-color)" strokeOpacity="0.5" strokeWidth="2" transform="rotate(45 160 130)" />
        )}
      </svg>

      <div style={{ position: "absolute", top: 32, left: 0, right: 0, textAlign: "center" }}>
        <span
          style={{
            background: "#170a17",
            padding: "0 14px",
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 24,
            color: "#f4f4f5",
            letterSpacing: "0.02em",
          }}
        >
          {team.name.toUpperCase()}
        </span>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 196, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 34,
            color: "var(--tier-color)",
            textShadow: "0 0 10px var(--tier-glow)",
            lineHeight: 1,
          }}
        >
          {rating.label}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8a8a90", marginTop: 6 }}>
          {unit.toUpperCase()}
        </div>

        <div
          style={{
            width: "80%",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 10,
            color: "#8a8a90",
            marginTop: 22,
          }}
        >
          <span>
            WINRATE <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.winrate ?? "—"}</b>
          </span>
          <span>
            СТРІК <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.streak ?? "—"}</b>
          </span>
          <span>
            ТУРНІРІВ <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.tournaments}</b>
          </span>
        </div>

        <div style={{ width: "80%", height: 1, background: "var(--tier-color)", opacity: 0.3, marginTop: 16 }} />

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#71717a", marginTop: 12 }}>
          СКЛАД · {unit.toUpperCase()}
        </div>

        <div style={{ width: "84%", marginTop: 6 }}>
          {mainPlayers.map((p, i) => (
            <div
              key={p.id ?? `${p.nick}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "4px 0",
                borderBottom: i === mainPlayers.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <div style={{ fontFamily: "'IBM Plex Sans'", fontSize: 13, fontWeight: 600, color: "#f4f4f5", lineHeight: 1.3 }}>
                  {effectivePlayerNick(team.discipline, p)}
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans'", fontSize: 10, color: "#71717a", lineHeight: 1.3 }}>{p.role}</div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: "var(--tier-color)" }}>
                {effectivePlayerRank(team.discipline, p)}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: "'Bebas Neue', sans-serif",
            letterSpacing: "0.12em",
            fontSize: 15,
            color: "var(--tier-color)",
            border: "1.5px solid var(--tier-color)",
            borderRadius: 2,
            padding: "6px 22px",
          }}
        >
          {rarity.toUpperCase()}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Valorant-зад: іконка режиму Spike Rush по центру (офіційна плоска іконка),
// 4 офіційні іконки ролей знизу, дрібні ability-іконки розкидані по фону
// напівпрозоро — усі реальні PNG з Riot's Asset Kit / Valorant Fandom wiki
// (дозволено користувачем для цього некомерційного навчального проєкту),
// перефарбовані в колір рідкості через CSS mask-image.
const ValorantBack = forwardRef(function ValorantBack({ team }, ref) {
  const id = uid(team);
  const maskStyle = (url, extra) => ({
    position: "absolute",
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    background: "var(--tier-color)",
    ...extra,
  });

  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "#170a17" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`vbClip-${id}`}>
            <polygon points={VALORANT_OCTAGON} />
          </clipPath>
          <pattern id={`vbHex-${id}`} width="34" height="30" patternUnits="userSpaceOnUse">
            <polygon points="8.5,0 25.5,0 34,15 25.5,30 8.5,30 0,15" fill="none" stroke="var(--tier-color)" strokeWidth="0.6" strokeOpacity="0.2" />
          </pattern>
          <radialGradient id={`vbVig-${id}`} cx="50%" cy="38%" r="70%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#vbClip-${id})`}>
          <rect width="320" height="600" fill="#170a17" />
          <rect width="320" height="600" fill="var(--tier-color)" opacity="var(--tier-grain)" />
          <rect width="320" height="600" fill={`url(#vbHex-${id})`} />
          <rect width="320" height="600" fill={`url(#vbVig-${id})`} />
        </g>
        <ValorantFrame />
      </svg>

      <div style={maskStyle(blastpackUrl, { left: 52, top: 120, width: 34, height: 34, opacity: 0.16, transform: "rotate(-12deg)" })} />
      <div style={maskStyle(curveballUrl, { left: 240, top: 150, width: 32, height: 32, opacity: 0.15, transform: "rotate(10deg)" })} />
      <div style={maskStyle(cybercageUrl, { left: 40, top: 320, width: 32, height: 32, opacity: 0.15, transform: "rotate(8deg)" })} />
      <div style={maskStyle(healingorbUrl, { left: 248, top: 340, width: 34, height: 34, opacity: 0.16, transform: "rotate(-8deg)" })} />

      <div
        style={maskStyle(spikeRushUrl, {
          left: 160,
          top: 250,
          width: 150,
          height: 150,
          transform: "translate(-50%,-50%)",
          filter: "drop-shadow(0 0 16px var(--tier-glow))",
        })}
      />

      <div
        style={{
          position: "absolute",
          top: 22,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.22em",
          color: "var(--tier-color)",
        }}
      >
        VALORANT
      </div>

      <div style={{ position: "absolute", top: 390, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 22 }}>
        <div style={maskStyle(duelistUrl, { position: "relative", width: 36, height: 36 })} />
        <div style={maskStyle(controllerUrl, { position: "relative", width: 36, height: 36 })} />
        <div style={maskStyle(initiatorUrl, { position: "relative", width: 36, height: 36 })} />
        <div style={maskStyle(sentinelUrl, { position: "relative", width: 36, height: 36 })} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 470,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "'Unbounded', sans-serif",
          fontWeight: 900,
          fontSize: 20,
          color: "#f4f4f5",
        }}
      >
        {team.name.toUpperCase()}
      </div>
    </div>
  );
});

// Ключі — той самий текст, що backend/prisma/seed.js пише в team.discipline.
// Визначено тут (не на початку файлу) — компоненти-переди/зади ще не
// проініціалізовані на момент виконання модуля, якщо оголосити мапи раніше
// за них (TDZ, той самий клас багу, що вже стався один раз із цим файлом).
const DISCIPLINE_FRONT = { Valorant: ValorantFront };
const DISCIPLINE_BACK = { CS2: CS2Back, "Dota 2": DotaBack, Valorant: ValorantBack };

// ---------------------------------------------------------------------------
// Заглушка на випадок нової дисципліни без власного дизайну заду (наразі всі
// три наявні дисципліни мають власний зад). Та сама рамка й тільки лого +
// назва команди, без гри-специфічної символіки.
const GenericBack = forwardRef(function GenericBack({ team }, ref) {
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "#0a0a0c" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`gjClip-${id}`}>
            <circle cx="160" cy="300" r="90" />
          </clipPath>
        </defs>
        <rect width="320" height="600" fill="#0a0a0c" />
        <rect width="320" height="600" fill="var(--tier-color)" opacity="var(--tier-grain)" />
        <circle cx="160" cy="300" r="90" fill="#09090B" stroke="var(--tier-color)" strokeWidth="3" />
        <g clipPath={`url(#gjClip-${id})`}>
          {team.logo ? (
            <image href={team.logo} x="70" y="210" width="180" height="180" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="70" y="210" width="180" height="180" fill="#09090B" />
          )}
        </g>
        <text x="160" y="450" textAnchor="middle" fontFamily="Unbounded, sans-serif" fontWeight="900" fontSize="20" fill="#f4f4f5">
          {team.name.toUpperCase()}
        </text>
        <text x="160" y="475" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="0.2em" fill="var(--tier-color)">
          {team.discipline.toUpperCase()}
        </text>
        <FrameChrome />
      </svg>
    </div>
  );
});
