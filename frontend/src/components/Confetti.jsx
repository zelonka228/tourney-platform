import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const COLORS = ["#00f0ff", "#dfff00", "#ff0055"];
const COUNT = 28;

function makeParticles() {
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.6;
    const distance = 90 + Math.random() * 90;
    return {
      id: i,
      color: COLORS[i % COLORS.length],
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30,
      rotate: Math.random() * 360,
      size: 5 + Math.random() * 4,
      delay: Math.random() * 0.08,
    };
  });
}

// One-shot particle burst reusing the site's own diamond bullet motif
// (see the rotate-45 squares used for roster bullets/logo mark elsewhere)
// instead of introducing generic confetti shapes. Fires once whenever
// `fire` flips from falsy to truthy — a ref (not state) tracks whether this
// mount has already celebrated, so a socket update that merely re-confirms
// the same champion doesn't replay the burst on every re-render.
export function ConfettiBurst({ fire }) {
  const [particles, setParticles] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (fire && !firedRef.current) {
      firedRef.current = true;
      setParticles(makeParticles());
      const timeout = window.setTimeout(() => setParticles(null), 1100);
      return () => window.clearTimeout(timeout);
    }
  }, [fire]);

  if (!particles) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: 0.9, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
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
