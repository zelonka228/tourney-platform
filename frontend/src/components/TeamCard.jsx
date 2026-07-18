// Портретна RPG-картка команди 320×600 з переднім/заднім боком (перевертання
// по кліку), анімацією появи "з крихітної та обертом" (Hearthstone-style) та
// оформленням заду під конкретну дисципліну (docs/04-rpg-card-spec.md).
// Задум і всі числові координати — з підтверджених макетів у
// .superpowers/brainstorm (final-full-demo-v5.html для CS2, push-quality-v6.html
// для Dota-самоцвіту), перенесені сюди 1:1 де це можливо.
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import dotaAegisUrl from "../assets/dota-aegis.png";
import dotaStrengthUrl from "../assets/dota-strength.png";
import dotaAgilityUrl from "../assets/dota-agility.png";
import dotaIntelligenceUrl from "../assets/dota-intelligence.png";
import dotaUniversalUrl from "../assets/dota-universal.png";
import packSealUrl from "../assets/pack-seal.png";
import { isPackOpened, markPackOpened } from "../lib/openedPacks";
import laserSoundUrl from "../assets/sounds/pack-laser.wav";
import shatterSoundUrl from "../assets/sounds/pack-shatter.wav";
import whooshSoundUrl from "../assets/sounds/pack-whoosh.wav";

// Кожен виклик створює новий Audio — так кілька паків можна відкрити
// одночасно (кожен зі своїм звуком, що не обриває сусідній), і той самий
// звук можна програти повторно без очікування, поки попередній дограє.
// .catch — браузер іноді блокує autoplay без явного user gesture, але клік
// по паку сам є user gesture, тому це радше страховка, ніж очікувана подія.
function playSound(url, volume = 0.6) {
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {});
}

// Значення за редкістю. Раніше застосовувались виключно як CSS custom
// properties (--tier-color тощо) через inline style на батьківському
// flip-контейнері, а компоненти нижче читали їх через var(--tier-color).
// html-to-image (PNG-експорт) клонує лише сам вузол активної сторони
// (frontRef/backRef), БЕЗ цього батька — і, як з'ясувалось емпірично,
// узагалі не резолвить CSS custom properties для будь-чого всередині
// вкладеного <svg> (ні як атрибут, ні як style-властивість), хоча для
// звичайних HTML-елементів (текст) резолвить нормально. Тому тепер кожен
// компонент нижче отримує вже ГОТОВІ рядкові значення кольору через проп
// `tier`, а не читає CSS-змінну — це працює однаково і на екрані, і в
// експорті, бо не залежить від того, як саме бібліотека клонує стилі.
const TIER_VALUES = {
  Common: { color: "#a1a1aa", glow: "rgba(161,161,170,0.18)", width: "2px", grain: "0.015" },
  Rare: { color: "#4b6bff", glow: "rgba(75,107,255,0.4)", width: "2.2px", grain: "0.02" },
  Epic: { color: "#e94bd6", glow: "rgba(233,75,214,0.45)", width: "2.5px", grain: "0.025" },
  Legendary: { color: "#ffd23f", glow: "rgba(255,178,50,0.5)", width: "3px", grain: "0.035" },
};

// Розкриття паку навмисно однакове на вигляд для будь-якої команди (сірий
// нейтральний конверт, без кольору тіра) — гравець не повинен здогадатись
// про рідкість ДО кліку. Різниця між тірами проявляється лише в самий момент
// розльоту частинок під час перевороту картки, той самий підхід, що в
// лутбоксах FIFA/CS2: кожен тір відчутно інший (кількість/розліт осколків),
// але це видно тільки як частина самого розкриття, не заздалегідь.
// Дистанції навмисно невеликі й консервативні (макс. shardDist+shardLen
// ~114px від медальйону на y=130) — щоб ефект завжди лишався всередині
// картки 320×600 і не вилазив за верхній край чи рамку.
const TIER_BURST = {
  Common: { shards: 5, shardDist: 46, shardLen: 12, duration: 0.55 },
  Rare: { shards: 9, shardDist: 60, shardLen: 15, duration: 0.65 },
  Epic: { shards: 12, shardDist: 74, shardLen: 18, duration: 0.8 },
  Legendary: { shards: 16, shardDist: 92, shardLen: 22, duration: 0.95 },
};

// Розрив паку — не дві половинки, а сітка дрібних фрагментів (лазерне
// розсічення на шматки), що розлітаються врізнобіч від центру картки.
// Кожен фрагмент — це div з тим самим фоновим зображенням паку, зсунутим
// (backgroundPosition) так, щоб показувати саме свій шматок — той самий
// прийом, що й у css-спрайтах, тільки навпаки (одна картинка ріжеться на N
// вікон замість N картинок в одній).
const SHATTER_COLS = 6;
const SHATTER_ROWS = 9;
const TILE_W = 320 / SHATTER_COLS;
const TILE_H = 600 / SHATTER_ROWS;
const SHATTER_IDLE = { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 };
const SHATTER_DURATION = 0.55;

// pack-seal.png — 1024×1536 (не рівно 320×600!), тому фон фрагментів має
// відтворювати те саме "cover"-масштабування й обрізку по центру, що
// browser сам робив для суцільного паку (background-size: cover). Інакше
// backgroundSize із фіксованим 320×600 просто розтягує/сплющує картинку під
// неправильні пропорції — саме це й було зіпсовано в попередній версії.
const PACK_IMG_W = 1024;
const PACK_IMG_H = 1536;
const PACK_COVER_SCALE = Math.max(320 / PACK_IMG_W, 600 / PACK_IMG_H);
const PACK_COVER_W = PACK_IMG_W * PACK_COVER_SCALE;
const PACK_COVER_H = PACK_IMG_H * PACK_COVER_SCALE;
const PACK_OFFSET_X = (PACK_COVER_W - 320) / 2;
const PACK_OFFSET_Y = (PACK_COVER_H - 600) / 2;

// Лазерний промінь, що "розрізає" пак у першу мить розриву — діагональна
// яскрава смуга пробігає зліва направо, mix-blend-mode screen дає ефект
// прожига, а не просто білої заливки.
const LASER_TRANSITION = { duration: 0.26, ease: "easeIn" };

// Скільки повних обертів картка робить під час вильоту з паку, помножене на
// 360 і зупинене саме на кратному 360 значенні (перед завжди на 0 за
// власним rotateY, зад — на 180 всередині себе) — щоб фінальний кадр вильоту
// показував ПЕРЕД без візуального "стрибка" при переході на подальші ручні
// перевороти (ті просто додають/віднімають 180 від цієї бази).
const BASE_ROTATE = 1080;

const SPIN_TIMES = [0, 0.32, 0.62, 0.85, 1];
const SPIN_KEYFRAMES = {
  rotateY: [180, 560, 920, 1050, BASE_ROTATE],
  scale: [0.12, 0.4, 0.85, 1.08, 1],
  y: [46, 14, -10, 3, 0],
  opacity: [0, 1, 1, 1, 1],
};
const SPIN_TRANSITION = {
  duration: 1.3,
  times: SPIN_TIMES,
  ease: ["easeIn", "circOut", "circOut", "backOut"],
};
const FLIP_TRANSITION = { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] };

const uid = (team) => String(team.id ?? team.name).replace(/[^a-zA-Z0-9]/g, "");

// forwardRef — html-to-image потребує пряме посилання на DOM-вузол активної
// (видимої) сторони картки, а не на обгортку з 3D-трансформацією.
export const TeamCard = forwardRef(function TeamCard({ team }, ref) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const frontRef = useRef(null);
  const backRef = useRef(null);
  // Пак, який цей браузер вже відкривав раніше (localStorage, без бекенду —
  // команди тут нікому не належать), одразу стартує в "opened"/revealed без
  // програвання анімації розкриття заново.
  const alreadyOpened = useMemo(() => isPackOpened(team.id), [team.id]);
  const [flipped, setFlipped] = useState(false);
  // closed -> tearing (пак розсікається лазером на фрагменти, що розлітаються)
  // -> flash -> opened (картка летить з обертами й гальмує) -> revealed=true.
  const [packPhase, setPackPhase] = useState(alreadyOpened ? "opened" : "closed");
  const [burst, setBurst] = useState(false);
  const [revealed, setRevealed] = useState(alreadyOpened);

  useImperativeHandle(ref, () => (flipped ? backRef.current : frontRef.current), [flipped]);

  // Сітка фрагментів для розриву паку — рахується один раз при монтуванні
  // (пак відкривається рівно один раз за життя цього компонента), кожен
  // фрагмент летить у своєму напрямку від центру картки (160,300) з власною
  // випадковою дистанцією/обертанням/невеликою затримкою для органічності.
  const shatterTiles = useMemo(() => {
    const tiles = [];
    for (let row = 0; row < SHATTER_ROWS; row++) {
      for (let col = 0; col < SHATTER_COLS; col++) {
        const cx = col * TILE_W + TILE_W / 2;
        const cy = row * TILE_H + TILE_H / 2;
        let dx = cx - 160;
        let dy = cy - 300;
        const mag = Math.hypot(dx, dy) || 1;
        dx /= mag;
        dy /= mag;
        const travel = 70 + Math.random() * 150;
        tiles.push({
          id: `${row}-${col}`,
          left: col * TILE_W,
          top: row * TILE_H,
          tx: dx * travel,
          ty: dy * travel,
          rotate: (Math.random() * 2 - 1) * 70,
          delay: Math.random() * 0.05,
        });
      }
    }
    return tiles;
  }, []);

  const mainPlayers = team.players.filter((p) => !p.isSubstitute);
  const unit = t(`unit.${DISCIPLINES[team.discipline].unitKey}`);
  const rating = avgRating(
    team.discipline,
    mainPlayers.map((p) => effectivePlayerRank(team.discipline, p))
  );
  const rarity = teamRarity(team);
  const tier = TIER_VALUES[rarity];
  const Front = DISCIPLINE_FRONT[team.discipline] ?? CardFront;
  const Back = DISCIPLINE_BACK[team.discipline] ?? GenericBack;

  function handleFlip() {
    if (!revealed) return;
    setFlipped((v) => !v);
  }

  // Клік по паку: лазерний промінь розсікає пак -> сітка фрагментів
  // розлітається врізнобіч і гасне -> коротка вспишка -> пак зникає, картка
  // вилітає з обертами. Таймінг нижче збігається з SHATTER_DURATION (0.55s),
  // інакше пак зникне раніше/пізніше, ніж фрагменти встигнуть розлетітись.
  function handlePackClick() {
    playSound(laserSoundUrl, 0.55);
    playSound(shatterSoundUrl, 0.45);
    setPackPhase("tearing");
    setTimeout(() => setPackPhase("flash"), SHATTER_DURATION * 1000);
    setTimeout(() => {
      setPackPhase("opened");
      playSound(whooshSoundUrl, 0.5);
      // MotionConfig reducedMotion="user" (App.jsx) can leave a multi-keyframe
      // animate (SPIN_KEYFRAMES below) stuck on its initial frame forever for
      // reduced-motion users — its onAnimationComplete then never fires, so
      // revealed/markPackOpened would never happen and the card could never be
      // flipped. Skip straight to the settled/revealed state for these users
      // instead of waiting on that callback.
      if (reducedMotion) revealCard();
    }, SHATTER_DURATION * 1000 + 170);
  }

  function revealCard() {
    if (revealed) return;
    setRevealed(true);
    setBurst(true);
    markPackOpened(team.id);
    setTimeout(() => setBurst(false), TIER_BURST[rarity].duration * 1000 + 150);
  }

  // Кінець вильоту-з-обертами (перший виклик; далі onAnimationComplete
  // спрацьовує і на ручних перевертаннях, але revealed вже true — нема ефекту).
  function handleSpinComplete() {
    revealCard();
  }

  const showPack = packPhase === "closed" || packPhase === "tearing";
  const showFlash = packPhase === "flash";
  const showCard = packPhase === "opened";
  const tearing = packPhase === "tearing";

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ perspective: "1200px", width: 320, height: 600, position: "relative" }}>
        {showPack && (
          <motion.div
            className="absolute inset-0"
            style={{ zIndex: 10 }}
            // Повільне "дихання" паку в стані спокою — запрошує клікнути, поки
            // не почався розріз. Зупиняється сама щойно tearing=true, бо
            // animate перемикається на нейтральний стан без repeat.
            animate={
              !tearing
                ? {
                    scale: [1, 1.02, 1],
                    filter: [
                      "drop-shadow(0 0 10px rgba(0,240,255,0.18))",
                      "drop-shadow(0 0 28px rgba(0,240,255,0.5))",
                      "drop-shadow(0 0 10px rgba(0,240,255,0.18))",
                    ],
                  }
                : { scale: 1, filter: "drop-shadow(0 0 10px rgba(0,240,255,0.18))" }
            }
            transition={
              !tearing
                ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.15 }
            }
          >
            {shatterTiles.map((tl) => (
              <motion.div
                key={tl.id}
                className="absolute"
                style={{
                  left: tl.left,
                  top: tl.top,
                  width: TILE_W + 0.5,
                  height: TILE_H + 0.5,
                  backgroundImage: `url(${packSealUrl})`,
                  backgroundSize: `${PACK_COVER_W}px ${PACK_COVER_H}px`,
                  backgroundPosition: `-${tl.left + PACK_OFFSET_X}px -${tl.top + PACK_OFFSET_Y}px`,
                }}
                animate={
                  tearing
                    ? { x: tl.tx, y: tl.ty, rotate: tl.rotate, opacity: 0, scale: 0.6 }
                    : SHATTER_IDLE
                }
                transition={
                  tearing
                    ? { duration: SHATTER_DURATION, delay: tl.delay, ease: "easeOut" }
                    : { duration: 0.15 }
                }
              />
            ))}
            {/* Лазерний розріз — яскрава діагональна смуга пробігає по паку в
                першу мить розриву, mix-blend-mode screen дає ефект прожига. */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(100deg, transparent 44%, #00f0ff 49%, #fff 50%, #00f0ff 51%, transparent 56%)",
                mixBlendMode: "screen",
              }}
              initial={{ opacity: 0, x: "-70%" }}
              animate={tearing ? { opacity: [0, 1, 0], x: ["-70%", "70%"] } : { opacity: 0 }}
              transition={tearing ? LASER_TRANSITION : { duration: 0.1 }}
            />
            <button
              type="button"
              data-testid="team-card-generate"
              aria-label={t("profile.card.generate")}
              onClick={handlePackClick}
              disabled={tearing}
              className="absolute inset-0 bg-transparent border-none cursor-pointer"
            />
          </motion.div>
        )}
        {showFlash && (
          <motion.div
            className="absolute inset-0 z-20 pointer-events-none rounded-md"
            style={{ background: "radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 72%)" }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.4, 1.6] }}
            transition={{ duration: 0.17, ease: "easeOut" }}
          />
        )}
        {showCard && (
          <motion.div
            onClick={handleFlip}
            data-testid="team-card-flip"
            style={
              reducedMotion
                ? {
                    // Framer Motion's own reducedMotion handling (MotionConfig in
                    // App.jsx) does not reliably apply a rotateY change here in
                    // testing — the flip (and, before packPhase reached "opened",
                    // the reveal spin) just never visually completed. Bypassing
                    // animate entirely and driving the transform straight off
                    // React state is the same fix already applied to routing in
                    // App.jsx for these users.
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    transformStyle: "preserve-3d",
                    cursor: revealed ? "pointer" : "default",
                    rotateY: flipped ? BASE_ROTATE + 180 : BASE_ROTATE,
                    scale: 1,
                    y: 0,
                    opacity: 1,
                  }
                : {
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    transformStyle: "preserve-3d",
                    cursor: revealed ? "pointer" : "default",
                  }
            }
            {...(reducedMotion
              ? {}
              : {
                  initial: alreadyOpened
                    ? { rotateY: BASE_ROTATE, scale: 1, y: 0, opacity: 1 }
                    : { rotateY: 180, scale: 0.12, y: 46, opacity: 0 },
                  animate: revealed
                    ? {
                        rotateY: flipped ? BASE_ROTATE + 180 : BASE_ROTATE,
                        scale: 1,
                        y: 0,
                        opacity: 1,
                      }
                    : SPIN_KEYFRAMES,
                  transition: revealed ? FLIP_TRANSITION : SPIN_TRANSITION,
                  onAnimationComplete: handleSpinComplete,
                })}
          >
            <Front
              ref={frontRef}
              team={team}
              rarity={rarity}
              rating={rating}
              unit={unit}
              mainPlayers={mainPlayers}
              tier={tier}
            />
            <Back ref={backRef} team={team} rarity={rarity} tier={tier} />
          </motion.div>
        )}
        {burst && <BurstParticles tier={tier} rarity={rarity} />}
      </div>
      {revealed && (
        <p className="text-[11px] font-mono text-[#52525b] uppercase tracking-widest">
          {t("profile.card.flipHint")}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Ефект розкриття рідкості — три шари замість хаотичних точок (ті виглядали
// як випадкове сміття на картці): тонована спалах-заливка, ударна хвиля-кільце
// й акуратні "осколки"-стрики (короткі світні риски, що летять по прямій, а
// не безформні цятки). Усе навмисно тримається в межах ~114px від медальйону
// (TIER_BURST), щоб нічого не вилазило за рамку картки. Показується лише в
// момент розкриття (не раніше) — єдине, що фактично видає рідкість команди.
function BurstParticles({ tier, rarity }) {
  const cfg = TIER_BURST[rarity] ?? TIER_BURST.Common;
  const shards = useMemo(
    () =>
      Array.from({ length: cfg.shards }, (_, i) => {
        const angle = (i / cfg.shards) * 360 + (Math.random() * 14 - 7);
        return {
          id: i,
          angle,
          dist: cfg.shardDist * (0.75 + Math.random() * 0.3),
          len: cfg.shardLen * (0.8 + Math.random() * 0.4),
        };
      }),
    [cfg]
  );
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none", overflow: "hidden" }}>
      {/* Точка вильоту — медальйон з лого команди (cy=130 у Front-компонентах). */}
      <div style={{ position: "absolute", left: "50%", top: 130, width: 0, height: 0 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.55, 0], scale: [0.3, 1, 1.15] }}
          transition={{ duration: cfg.duration * 0.7, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: -110,
            top: -110,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${tier.color}55 0%, transparent 70%)`,
          }}
        />
        <motion.div
          initial={{ opacity: 0.9, scale: 0.25 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: cfg.duration, ease: "circOut" }}
          style={{
            position: "absolute",
            left: -95,
            top: -95,
            width: 190,
            height: 190,
            borderRadius: "50%",
            border: `2px solid ${tier.color}`,
            boxShadow: `0 0 18px ${tier.glow}`,
          }}
        />
        {shards.map((s) => {
          const rad = (s.angle * Math.PI) / 180;
          return (
            <motion.span
              key={s.id}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: Math.cos(rad) * s.dist, y: Math.sin(rad) * s.dist, opacity: 0 }}
              transition={{ duration: cfg.duration, ease: "easeOut" }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: s.len,
                height: 3,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${tier.color}, transparent)`,
                transformOrigin: "left center",
                transform: `rotate(${s.angle}deg)`,
                boxShadow: `0 0 6px ${tier.glow}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Спільна рамка з тонкими кутовими скобами та ромбовими шипами по кутах —
// однакова для переду й усіх задів, лише колір іде з проп tier. Винесена
// окремо, щоб не дублювати одну й ту саму геометрію в 3 місцях.
function FrameChrome({ tier }) {
  return (
    <>
      <rect x="9" y="9" width="302" height="582" fill="none" stroke={tier.color} strokeWidth={tier.width} />
      <rect x="18" y="18" width="284" height="564" fill="none" stroke={tier.color} strokeWidth="1" strokeOpacity="0.4" />
      <g stroke={tier.color} strokeWidth="2.4" fill="none">
        <path d="M9,46 L9,9 L46,9" />
        <path d="M311,46 L311,9 L274,9" />
        <path d="M9,554 L9,591 L46,591" />
        <path d="M311,554 L311,591 L274,591" />
      </g>
      <g fill={tier.color}>
        <rect x="4.5" y="4.5" width="9" height="9" transform="rotate(45 9 9)" />
        <rect x="306.5" y="4.5" width="9" height="9" transform="rotate(45 311 9)" />
        <rect x="4.5" y="586.5" width="9" height="9" transform="rotate(45 9 591)" />
        <rect x="306.5" y="586.5" width="9" height="9" transform="rotate(45 311 591)" />
      </g>
      <g fill={tier.color}>
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
const CardFront = forwardRef(function CardFront({ team, rarity, rating, unit, mainPlayers, tier }, ref) {
  const { t } = useI18n();
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ background: "transparent" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`fjClip-${id}`}>
            <circle cx="160" cy="130" r="46" />
          </clipPath>
          <pattern id={`fjCircuit-${id}`} width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M0,23 L17,23 L17,6 L34,6" fill="none" stroke={tier.color} strokeWidth="0.7" strokeOpacity="0.09" />
            <path d="M46,23 L29,23 L29,40 L12,40" fill="none" stroke={tier.color} strokeWidth="0.7" strokeOpacity="0.09" />
            <circle cx="17" cy="6" r="1.3" fill={tier.color} opacity="0.12" />
            <circle cx="29" cy="40" r="1.3" fill={tier.color} opacity="0.12" />
          </pattern>
        </defs>
        <rect width="320" height="600" fill="#0c0c0e" />
        <rect width="320" height="600" fill={`url(#fjCircuit-${id})`} />
        <FrameChrome tier={tier} />
        <line x1="46" y1="44" x2="274" y2="44" stroke={tier.color} strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="160" cy="130" r="46" fill="#09090B" stroke={tier.color} strokeWidth="3.5" />
        <g clipPath={`url(#fjClip-${id})`}>
          {team.logo ? (
            <image href={team.logo} x="114" y="84" width="92" height="92" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="114" y="84" width="92" height="92" fill="#09090B" />
          )}
        </g>
        {!team.logo && (
          <rect x="146" y="116" width="28" height="28" fill="none" stroke={tier.color} strokeOpacity="0.5" strokeWidth="2" transform="rotate(45 160 130)" />
        )}
      </svg>

      <div style={{ position: "absolute", top: 34, left: 0, right: 0, textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            background: "#0c0c0e",
            padding: "0 14px",
            fontFamily: "'Unbounded', sans-serif",
            fontWeight: 800,
            fontSize: 16,
            color: "#f4f4f5",
          }}
        >
          {team.name.toUpperCase()}
        </span>
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
            {t("profile.winrate").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.winrate ?? "—"}</b>
          </span>
          <span>
            {t("profile.streak").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.streak ?? "—"}</b>
          </span>
          <span>
            {t("profile.tournaments").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.tournaments}</b>
          </span>
        </div>

        <div style={{ width: "78%", height: 1, background: tier.color, opacity: 0.3, marginTop: 18 }} />

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#71717a", marginTop: 14 }}>
          {t("profile.roster").toUpperCase()} · {unit.toUpperCase()}
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
            color: tier.color,
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
const CS2Back = forwardRef(function CS2Back({ team, tier }, ref) {
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
    background: tier.color,
    filter: `drop-shadow(0 0 8px ${tier.glow})`,
  });

  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "transparent" })}>
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
        <rect width="320" height="600" fill={tier.color} opacity={tier.grain} />
        <rect width="320" height="600" fill={`url(#bjVig-${id})`} />

        <circle cx="160" cy="68" r="34" stroke={tier.color} strokeWidth="2" fill="none" />
        <circle cx="160" cy="68" r="24" stroke={tier.color} strokeWidth="1.2" fill="none" opacity="0.5" />
        <g stroke={tier.color} strokeWidth="2">
          <line x1="160" y1="22" x2="160" y2="32" />
          <line x1="160" y1="104" x2="160" y2="114" />
          <line x1="114" y1="68" x2="124" y2="68" />
          <line x1="196" y1="68" x2="206" y2="68" />
        </g>
        <text x="160" y="68" textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="14" letterSpacing="0.5" fill={tier.color}>
          CS2
        </text>

        <circle cx="160" cy="300" r="135" fill={`url(#bjMedallion-${id})`} stroke={tier.color} strokeWidth="2.8" />
        <circle cx="160" cy="300" r="123" fill="none" stroke={tier.color} strokeWidth="1.3" strokeOpacity="0.5" />

        <text x="160" y="490" textAnchor="middle" fontFamily="Unbounded, sans-serif" fontWeight="900" fontSize="22" fill="#f4f4f5">
          {team.name.toUpperCase()}
        </text>

        <FrameChrome tier={tier} />
      </svg>
      <div style={rifleStyle("rotate(-45deg)")} />
      <div style={rifleStyle("rotate(45deg) scaleX(-1)")} />
    </div>
  );
});

const DOTA_HEX = "160,0 320,40 320,560 160,600 0,560 0,40";
const DOTA_HEX_INNER = "160,9 315,48 315,552 160,591 5,552 5,48";

// Шестикутна "рунний камінь" рамка Dota-карток (перед+зад) — інша геометрія,
// ніж FrameChrome (CS2, прямокутник) і ValorantFrame (восьмикутник). Самоцвіт
// зверху й знизу, ромбові шипи на всіх 6 вершинах.
function DotaFrame({ tier }) {
  return (
    <>
      <polygon points={DOTA_HEX} fill="none" stroke={tier.color} strokeWidth={tier.width} />
      <polygon points={DOTA_HEX_INNER} fill="none" stroke={tier.color} strokeWidth="1" strokeOpacity="0.4" />
      <g fill={tier.color}>
        <rect x="155.5" y="-4.5" width="9" height="9" transform="rotate(45 160 0)" />
        <rect x="315.5" y="35.5" width="9" height="9" transform="rotate(45 320 40)" />
        <rect x="315.5" y="555.5" width="9" height="9" transform="rotate(45 320 560)" />
        <rect x="155.5" y="595.5" width="9" height="9" transform="rotate(45 160 600)" />
        <rect x="-4.5" y="555.5" width="9" height="9" transform="rotate(45 0 560)" />
        <rect x="-4.5" y="35.5" width="9" height="9" transform="rotate(45 0 40)" />
      </g>
      <circle cx="160" cy="16" r="7" fill="#1a0a08" stroke={tier.color} strokeWidth="1.4" />
      <path d="M160,11 L163,16 L160,21 L157,16 Z" fill={tier.color} />
    </>
  );
}

const dotaHexGrid = (id, opacity, color) => (
  <pattern id={id} width="34" height="30" patternUnits="userSpaceOnUse">
    <polygon points="8.5,0 25.5,0 34,15 25.5,30 8.5,30 0,15" fill="none" stroke={color} strokeWidth="0.6" strokeOpacity={opacity} />
  </pattern>
);

// ---------------------------------------------------------------------------
// Dota-перед: шестикутна рамка, Cinzel (антична декоративна засічка — інший
// характер, ніж Unbounded у CS2 чи Bebas Neue у Valorant), той самий
// контент-флоу (top:194), що й CardFront/ValorantFront.
const DotaFront = forwardRef(function DotaFront({ team, rarity, rating, unit, mainPlayers, tier }, ref) {
  const { t } = useI18n();
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ background: "transparent" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`dfClip-${id}`}>
            <polygon points={DOTA_HEX} />
          </clipPath>
          <clipPath id={`dfPortrait-${id}`}>
            <circle cx="160" cy="130" r="46" />
          </clipPath>
          {dotaHexGrid(`dfHex-${id}`, 0.08, tier.color)}
        </defs>
        <g clipPath={`url(#dfClip-${id})`}>
          <rect width="320" height="600" fill="#1a0a08" />
          <rect width="320" height="600" fill={`url(#dfHex-${id})`} />
        </g>
        <DotaFrame tier={tier} />
        <line x1="46" y1="44" x2="274" y2="44" stroke={tier.color} strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="160" cy="130" r="46" fill="#09090B" stroke={tier.color} strokeWidth="3.5" />
        <g clipPath={`url(#dfPortrait-${id})`}>
          {team.logo ? (
            <image href={team.logo} x="114" y="84" width="92" height="92" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="114" y="84" width="92" height="92" fill="#09090B" />
          )}
        </g>
        {!team.logo && (
          <rect x="146" y="116" width="28" height="28" fill="none" stroke={tier.color} strokeOpacity="0.5" strokeWidth="2" transform="rotate(45 160 130)" />
        )}
      </svg>

      <div style={{ position: "absolute", top: 32, left: 0, right: 0, textAlign: "center" }}>
        <span
          style={{
            background: "#1a0a08",
            padding: "0 14px",
            fontFamily: "'Cinzel', serif",
            fontWeight: 800,
            fontSize: 19,
            color: "#f4e9d8",
            letterSpacing: "0.04em",
          }}
        >
          {team.name.toUpperCase()}
        </span>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 194, display: "flex", flexDirection: "column", alignItems: "center" }}>
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
            marginTop: 18,
          }}
        >
          <span>
            {t("profile.winrate").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.winrate ?? "—"}</b>
          </span>
          <span>
            {t("profile.streak").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.streak ?? "—"}</b>
          </span>
          <span>
            {t("profile.tournaments").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.tournaments}</b>
          </span>
        </div>

        <div style={{ width: "78%", height: 1, background: tier.color, opacity: 0.3, marginTop: 16 }} />

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#71717a", marginTop: 12 }}>
          {t("profile.roster").toUpperCase()} · {unit.toUpperCase()}
        </div>

        <div style={{ width: "80%", marginTop: 7 }}>
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
            textAlign: "center",
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            letterSpacing: "0.15em",
            fontSize: 14,
            color: tier.color,
            marginTop: 18,
          }}
        >
          {rarity.toUpperCase()}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Dota-зад: медальйон з реальною іконкою Aegis of the Immortal (головний
// трофей гри, вручається переможцю The International) — м'яка radial-gradient
// маска замість твердого прямокутника (Aegis-рендер має білий фон, який
// інакше проступав би крізь темний медальйон), і ряд реальних іконок
// атрибутів (Strength/Agility/Intelligence/Universal) під ним, приглушений
// (opacity 0.55), щоб не конкурувати з Aegis як головним акцентом.
const DotaBack = forwardRef(function DotaBack({ team, tier }, ref) {
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "transparent" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`dbClip-${id}`}>
            <polygon points={DOTA_HEX} />
          </clipPath>
          {dotaHexGrid(`dbHex-${id}`, 0.16, tier.color)}
          <radialGradient id={`dbVig-${id}`} cx="50%" cy="32%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id={`dbSocket-${id}`} cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#2a1006" />
            <stop offset="70%" stopColor="#160a04" />
            <stop offset="100%" stopColor="#1a0a08" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#dbClip-${id})`}>
          <rect width="320" height="600" fill="#1a0a08" />
          <rect width="320" height="600" fill={tier.color} opacity={tier.grain} />
          <rect width="320" height="600" fill={`url(#dbHex-${id})`} />
          <rect width="320" height="600" fill={`url(#dbVig-${id})`} />
        </g>

        <DotaFrame tier={tier} />

        <text x="160" y="48" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="700" fontSize="18" letterSpacing="0.15em" fill={tier.color}>
          DOTA 2
        </text>

        <circle cx="160" cy="290" r="135" fill={`url(#dbSocket-${id})`} stroke={tier.color} strokeWidth="2.8" />
        <circle cx="160" cy="290" r="123" fill="none" stroke={tier.color} strokeWidth="1.3" strokeOpacity="0.5" />
      </svg>

      <img
        src={dotaAegisUrl}
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: 290,
          transform: "translate(-50%,-50%)",
          width: 220,
          height: 194,
          objectFit: "contain",
          WebkitMaskImage: "radial-gradient(ellipse 58% 58% at center, black 45%, transparent 82%)",
          maskImage: "radial-gradient(ellipse 58% 58% at center, black 45%, transparent 82%)",
          filter: `drop-shadow(0 0 10px ${tier.glow})`,
        }}
      />

      <div style={{ position: "absolute", top: 452, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16, opacity: 0.55 }}>
        <img src={dotaStrengthUrl} alt="" style={{ width: 34, height: 34 }} />
        <img src={dotaAgilityUrl} alt="" style={{ width: 34, height: 34 }} />
        <img src={dotaIntelligenceUrl} alt="" style={{ width: 34, height: 34 }} />
        <img src={dotaUniversalUrl} alt="" style={{ width: 34, height: 34 }} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 500,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "'Cinzel', serif",
          fontWeight: 800,
          fontSize: 21,
          color: "#f4e9d8",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        {team.name.toUpperCase()}
      </div>
    </div>
  );
});

const VALORANT_OCTAGON = "26,0 294,0 320,26 320,574 294,600 26,600 0,574 0,26";

// Восьмикутна рамка Valorant-карток (перед+зад) — інша геометрія, ніж
// FrameChrome (прямокутник з кутовими скобами) для CS2/Dota, тому окрема
// функція, а не параметризація тієї самої.
function ValorantFrame({ tier }) {
  return (
    <>
      <g stroke={tier.color} strokeWidth="1.8">
        <line x1="18" y1="36" x2="18" y2="48" />
        <line x1="302" y1="36" x2="302" y2="48" />
        <line x1="18" y1="552" x2="18" y2="564" />
        <line x1="302" y1="552" x2="302" y2="564" />
      </g>
      <polygon points={VALORANT_OCTAGON} fill="none" stroke={tier.color} strokeWidth={tier.width} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Valorant-перед: восьмикутний виріз рамки, Bebas Neue (реальний UI-шрифт
// гри — Tungsten платний, Bebas Neue найближчий безкоштовний аналог) і лінія
// замість трапеції під назвою команди. Той самий контент-флоу (top:196), що
// й CardFront, — той самий клас багу з накладанням ростера вже виключено.
const ValorantFront = forwardRef(function ValorantFront(
  { team, rarity, rating, unit, mainPlayers, tier },
  ref
) {
  const { t } = useI18n();
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ background: "transparent" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`vfClip-${id}`}>
            <polygon points={VALORANT_OCTAGON} />
          </clipPath>
          <clipPath id={`vfPortrait-${id}`}>
            <circle cx="160" cy="130" r="46" />
          </clipPath>
          <pattern id={`vfShard-${id}`} width="52" height="52" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
            <rect x="0" width="6" height="52" fill={tier.color} opacity="0.06" />
            <rect x="26" width="3" height="52" fill={tier.color} opacity="0.04" />
          </pattern>
        </defs>
        <g clipPath={`url(#vfClip-${id})`}>
          <rect width="320" height="600" fill="#170a17" />
          <rect width="320" height="600" fill={`url(#vfShard-${id})`} />
        </g>
        <ValorantFrame tier={tier} />
        <line x1="46" y1="44" x2="274" y2="44" stroke={tier.color} strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="160" cy="130" r="46" fill="#09090B" stroke={tier.color} strokeWidth="3.5" />
        <g clipPath={`url(#vfPortrait-${id})`}>
          {team.logo ? (
            <image href={team.logo} x="114" y="84" width="92" height="92" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x="114" y="84" width="92" height="92" fill="#09090B" />
          )}
        </g>
        {!team.logo && (
          <rect x="146" y="116" width="28" height="28" fill="none" stroke={tier.color} strokeOpacity="0.5" strokeWidth="2" transform="rotate(45 160 130)" />
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
            color: tier.color,
            textShadow: `0 0 10px ${tier.glow}`,
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
            {t("profile.winrate").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.winrate ?? "—"}</b>
          </span>
          <span>
            {t("profile.streak").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.streak ?? "—"}</b>
          </span>
          <span>
            {t("profile.tournaments").toUpperCase()}{" "}
            <b style={{ color: "#f4f4f5", fontFamily: "'JetBrains Mono', monospace" }}>{team.tournaments}</b>
          </span>
        </div>

        <div style={{ width: "80%", height: 1, background: tier.color, opacity: 0.3, marginTop: 16 }} />

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#71717a", marginTop: 12 }}>
          {t("profile.roster").toUpperCase()} · {unit.toUpperCase()}
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
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: tier.color }}>
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
            color: tier.color,
            border: `1.5px solid ${tier.color}`,
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
const ValorantBack = forwardRef(function ValorantBack({ team, tier }, ref) {
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
    background: tier.color,
    ...extra,
  });

  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "transparent" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`vbClip-${id}`}>
            <polygon points={VALORANT_OCTAGON} />
          </clipPath>
          <pattern id={`vbHex-${id}`} width="34" height="30" patternUnits="userSpaceOnUse">
            <polygon points="8.5,0 25.5,0 34,15 25.5,30 8.5,30 0,15" fill="none" stroke={tier.color} strokeWidth="0.6" strokeOpacity="0.2" />
          </pattern>
          <radialGradient id={`vbVig-${id}`} cx="50%" cy="38%" r="70%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#vbClip-${id})`}>
          <rect width="320" height="600" fill="#170a17" />
          <rect width="320" height="600" fill={tier.color} opacity={tier.grain} />
          <rect width="320" height="600" fill={`url(#vbHex-${id})`} />
          <rect width="320" height="600" fill={`url(#vbVig-${id})`} />
        </g>
        <ValorantFrame tier={tier} />
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
          filter: `drop-shadow(0 0 16px ${tier.glow})`,
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
          color: tier.color,
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
const DISCIPLINE_FRONT = { "Dota 2": DotaFront, Valorant: ValorantFront };
const DISCIPLINE_BACK = { CS2: CS2Back, "Dota 2": DotaBack, Valorant: ValorantBack };

// ---------------------------------------------------------------------------
// Заглушка на випадок нової дисципліни без власного дизайну заду (наразі всі
// три наявні дисципліни мають власний зад). Та сама рамка й тільки лого +
// назва команди, без гри-специфічної символіки.
const GenericBack = forwardRef(function GenericBack({ team, tier }, ref) {
  const id = uid(team);
  return (
    <div ref={ref} style={faceStyle({ transform: "rotateY(180deg)", background: "transparent" })}>
      <svg viewBox="0 0 320 600" width="100%" height="100%">
        <defs>
          <clipPath id={`gjClip-${id}`}>
            <circle cx="160" cy="300" r="90" />
          </clipPath>
        </defs>
        <rect width="320" height="600" fill="#0a0a0c" />
        <rect width="320" height="600" fill={tier.color} opacity={tier.grain} />
        <circle cx="160" cy="300" r="90" fill="#09090B" stroke={tier.color} strokeWidth="3" />
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
        <text x="160" y="475" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="0.2em" fill={tier.color}>
          {team.discipline.toUpperCase()}
        </text>
        <FrameChrome tier={tier} />
      </svg>
    </div>
  );
});
