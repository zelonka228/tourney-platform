// Shared motion primitives — small, reusable pieces of "juice" applied
// consistently across pages instead of one-off animation code per page.
// Both respect MotionConfig(reducedMotion="user") set in App.jsx: framer
// automatically simplifies/skips these when the OS asks for less motion.
import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

// Counts up to `value`. Non-numeric values (e.g. the "—" placeholder shown
// before live stats load) render as plain text — there's nothing to animate
// towards. `format` overrides how each animated frame is rendered — e.g.
// Valorant's rank isn't a number at all, but the average rating still
// resolves to a numeric VALORANT_RANKS index, so passing
// `format={(v) => VALORANT_RANKS[Math.round(v)]}` turns the same count-up
// into a rank ticking upward (Iron → ... → Immortal) instead of raw digits,
// while CS2/Dota's plain integer rating needs no formatter.
//
// By default the count-up waits until scrolled into view (`immediate:
// false`) — right for stuff below the fold, like Landing's stats row. Pass
// `immediate` for a value that's already on-screen the moment it mounts
// (a freshly-opened team detail view, a widget that just expanded): the
// scroll-gated version has no fallback if that element is never actually
// scrolled past — e.g. the page was already scrolled down when the detail
// view mounted — leaving it stuck at 0 forever instead of showing the real
// number.
export function AnimatedNumber({ value, className = "", format, immediate = false }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => (format ? format(v) : Math.round(v).toLocaleString()));

  useEffect(() => {
    if ((immediate || inView) && typeof value === "number") motionValue.set(value);
  }, [immediate, inView, value]);

  if (typeof value !== "number") {
    return (
      <span ref={ref} className={className}>
        {value}
      </span>
    );
  }
  // The spring's frame-by-frame convergence isn't guaranteed to ever resolve
  // for reduced-motion users (the same class of stuck-animation issue fixed
  // in App.jsx for route transitions) — just show the final value directly.
  if (reducedMotion) {
    return (
      <span ref={ref} className={className}>
        {format ? format(value) : Math.round(value).toLocaleString()}
      </span>
    );
  }
  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

// Fades + slides an element in once it scrolls into view. `index` drives a
// stagger delay for lists — pass the item's position so siblings cascade in
// instead of popping together.
export function Reveal({ children, index = 0, y = 20, className = "", once = true, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-10% 0px" }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
