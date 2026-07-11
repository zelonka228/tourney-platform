// Shared motion primitives — small, reusable pieces of "juice" applied
// consistently across pages instead of one-off animation code per page.
// Both respect MotionConfig(reducedMotion="user") set in App.jsx: framer
// automatically simplifies/skips these when the OS asks for less motion.
import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";

// Counts up to `value` once it scrolls into view. Non-numeric values (e.g.
// the "—" placeholder shown before live stats load) render as plain text —
// there's nothing to animate towards.
export function AnimatedNumber({ value, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (inView && typeof value === "number") motionValue.set(value);
  }, [inView, value]);

  if (typeof value !== "number") {
    return (
      <span ref={ref} className={className}>
        {value}
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
