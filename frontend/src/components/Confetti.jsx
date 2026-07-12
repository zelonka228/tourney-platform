import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = ["#00f0ff", "#dfff00", "#ff0055"];
const COUNT = 22;

function makeParticles() {
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.6;
    const distance = 70 + Math.random() * 80;
    return {
      id: i,
      color: COLORS[i % COLORS.length],
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20,
      rotate: 180 + Math.random() * 180,
      size: 5 + Math.random() * 4,
      duration: 2.6 + Math.random() * 1.4,
      delay: Math.random() * 1.2,
    };
  });
}

// Ambient particle drift around the champion banner, reusing the site's own
// diamond bullet motif (the rotate-45 squares used for roster bullets/logo
// mark elsewhere) instead of generic confetti shapes. Unlike a one-shot
// burst — which read as "gone in a blink" — each particle drifts out and
// gently back in an infinite mirrored loop (`repeatType: "mirror"`), so the
// celebration stays visible the whole time a champion is showing rather
// than flashing once. Particles are generated once via useMemo (not on
// every render) so the loop stays stable instead of restarting on
// unrelated re-renders (e.g. a socket update re-confirming the same
// champion).
export function ConfettiBurst({ fire }) {
  const particles = useMemo(() => (fire ? makeParticles() : null), [fire]);

  if (!particles) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: p.x, y: p.y, rotate: p.rotate }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          }}
          className="absolute left-1/2 top-1/2"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            transform: "rotate(45deg)",
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
