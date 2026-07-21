import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";

const CYAN = [0, 240, 255];
const VOLT = [223, 255, 0];
const MAGENTA = [233, 75, 214];

// Shared scaffolding for the four page-specific ambient backgrounds below:
// a fixed, full-viewport <canvas> portaled straight to document.body (same
// fix as VictoryScene — a positioned/z-indexed ancestor like <main> would
// otherwise cap these below the header), sitting behind all page content at
// z-index -1, resize-aware, and gated by prefers-reduced-motion.
function useBackgroundCanvas(draw) {
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = null;
    let w = 0;
    let h = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const state = { t: 0 };
    const getSize = () => ({ w, h });

    function loop(now) {
      draw(ctx, getSize(), now, state);
      raf = requestAnimationFrame(loop);
    }

    if (reducedMotion) {
      draw(ctx, getSize(), 0, state);
    } else {
      raf = requestAnimationFrame(loop);
    }

    function onResize() {
      resize();
      if (reducedMotion) draw(ctx, getSize(), 0, state);
    }
    window.addEventListener("resize", onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [draw, reducedMotion]);

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    />,
    document.body
  );
}

// Тurnament — thin data-grid with light pulses running along random lines.
export function SignalGridBg() {
  const draw = useRef((ctx, { w, h }, now, state) => {
    const cell = 46;
    if (!state.pulses) state.pulses = [];
    if (!state.last) state.last = now;
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,240,255,0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (Math.random() < 0.012) {
      const horizontal = Math.random() < 0.5;
      const line = Math.floor(Math.random() * (horizontal ? h / cell : w / cell));
      state.pulses.push({ horizontal, line: line * cell, t: 0, len: 70 + Math.random() * 50, speed: 100 + Math.random() * 70 });
    }
    state.pulses = state.pulses.filter((p) => {
      p.t += p.speed * dt;
      const span = p.horizontal ? w : h;
      if (p.t - p.len > span) return false;
      const grad = p.horizontal
        ? ctx.createLinearGradient(p.t - p.len, 0, p.t, 0)
        : ctx.createLinearGradient(0, p.t - p.len, 0, p.t);
      grad.addColorStop(0, "rgba(0,240,255,0)");
      grad.addColorStop(1, "rgba(0,240,255,0.55)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (p.horizontal) { ctx.moveTo(Math.max(0, p.t - p.len), p.line); ctx.lineTo(p.t, p.line); }
      else { ctx.moveTo(p.line, Math.max(0, p.t - p.len)); ctx.lineTo(p.line, p.t); }
      ctx.stroke();
      return true;
    });
  }).current;
  return useBackgroundCanvas(draw);
}

// Collection — soft glowing motes drifting upward, like ambient dust from a
// freshly opened pack.
export function EmberDriftBg() {
  const draw = useRef((ctx, { w, h }, now, state) => {
    if (!state.embers) state.embers = [];
    if (!state.last) state.last = now;
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;

    ctx.clearRect(0, 0, w, h);
    const palette = [CYAN, VOLT, MAGENTA];
    while (state.embers.length < 34) {
      state.embers.push({
        x: Math.random() * w,
        y: h + Math.random() * 40,
        r: 1.2 + Math.random() * 2,
        vy: 8 + Math.random() * 12,
        sway: Math.random() * Math.PI * 2,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }
    state.embers = state.embers.filter((e) => e.y > -20);
    for (const e of state.embers) {
      e.y -= e.vy * dt;
      e.sway += dt;
      e.x += Math.sin(e.sway) * 8 * dt;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${e.color.join(",")},0.45)`;
      ctx.shadowColor = `rgba(${e.color.join(",")},0.8)`;
      ctx.shadowBlur = 6;
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }).current;
  return useBackgroundCanvas(draw);
}

// Hall of fame — a row of stat bars along the bottom edge, breathing up
// and down like an equalizer/leaderboard chart. Each bar drifts on its own
// sine (own frequency + phase) rather than jumping randomly, so it reads as
// live data ticking rather than noise.
export function StatBarsBg() {
  const draw = useRef((ctx, { w, h }, now, state) => {
    if (!state.bars) {
      const count = Math.max(24, Math.round(w / 28));
      state.bars = Array.from({ length: count }, (_, i) => ({
        base: 0.08 + Math.random() * 0.1,
        amp: 0.06 + Math.random() * 0.22,
        freq: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        volt: Math.random() < 0.15,
      }));
    }
    const t = now * 0.001;
    ctx.clearRect(0, 0, w, h);

    const count = state.bars.length;
    const gap = w / count;
    const barW = gap * 0.5;
    for (let i = 0; i < count; i++) {
      const b = state.bars[i];
      const level = b.base + b.amp * (0.5 + 0.5 * Math.sin(t * b.freq + b.phase));
      const barH = level * h * 0.32;
      const x = i * gap + (gap - barW) / 2;
      const color = b.volt ? VOLT : CYAN;
      const grad = ctx.createLinearGradient(0, h, 0, h - barH);
      grad.addColorStop(0, `rgba(${color.join(",")},0.16)`);
      grad.addColorStop(1, `rgba(${color.join(",")},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, h - barH, barW, barH);
    }
  }).current;
  return useBackgroundCanvas(draw);
}

// Profile / comparison — slow, near-static topographic lines. Deliberately
// the calmest of the four: these pages are read-heavy and shouldn't compete
// with the background for attention.
export function ContourLinesBg() {
  const draw = useRef((ctx, { w, h }, now, state) => {
    state.t = now * 0.00035;
    ctx.clearRect(0, 0, w, h);
    const rows = 9;
    for (let i = 0; i < rows; i++) {
      const baseY = (h / (rows + 1)) * (i + 1);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) {
        const y = baseY + Math.sin(x * 0.01 + state.t * 2 + i * 0.9) * (12 + i * 1.4);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(0,240,255,${0.035 + (i % 2) * 0.015})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }).current;
  return useBackgroundCanvas(draw);
}
