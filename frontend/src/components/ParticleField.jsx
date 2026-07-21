import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const CYAN = [0, 240, 255];
const VOLT = [223, 255, 0];
const COUNT = 70;
const LINK_DIST = 130;
const CURSOR_LINK_DIST = 200;

// Plain <canvas> + requestAnimationFrame — a "network" of drifting dots that
// link up with thin lines when close to each other or to the cursor, in the
// site's own cyan/volt palette. Sits as a decorative layer over the hero's
// existing background image (pointer-events-none, so it never blocks the
// CTA buttons above it); the section itself forwards mouse position in via
// a ref rather than the canvas listening directly, for exactly that reason.
export function ParticleField({ className = "" }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    let raf = null;
    let particles = [];
    let w = 0;
    let h = 0;

    function resize() {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticles() {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        volt: Math.random() < 0.18,
        r: 1 + Math.random() * 1.4,
      }));
    }

    function draw(moving) {
      ctx.clearRect(0, 0, w, h);
      const { x: mx, y: my } = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (moving) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          p.x = Math.max(0, Math.min(w, p.x));
          p.y = Math.max(0, Math.min(h, p.y));
        }
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            ctx.strokeStyle = `rgba(${CYAN.join(",")},${0.16 * (1 - dist / LINK_DIST)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        const dMouse = Math.hypot(p.x - mx, p.y - my);
        if (dMouse < CURSOR_LINK_DIST) {
          ctx.strokeStyle = `rgba(${VOLT.join(",")},${0.35 * (1 - dMouse / CURSOR_LINK_DIST)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.stroke();
        }
        const color = p.volt ? VOLT : CYAN;
        ctx.fillStyle = `rgba(${color.join(",")},0.8)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      draw(true);
      raf = requestAnimationFrame(loop);
    }

    resize();
    makeParticles();
    if (reducedMotion) {
      // One static frame — still shows the network, just doesn't drift or
      // chase the cursor. No rAF loop at all, not even a throttled one.
      draw(false);
    } else {
      loop();
    }

    function onResize() {
      resize();
      makeParticles();
      if (reducedMotion) draw(false);
    }
    // Listened on window, not the canvas's own parent — the hero's text/CTA
    // content is a sibling of the background layer this canvas lives in,
    // stacked on top via z-index, so mousemove over the text would never
    // reach a listener scoped to the background div (different branch of
    // the tree, event bubbles up its own ancestry, not across siblings).
    // window sidesteps that entirely; position is still converted relative
    // to this canvas's own bounding rect either way.
    function onMouseMove(e) {
      const rect = parent.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseout", onMouseLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseLeave);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
}
