// Shared tactical UI primitives.
import { motion } from "framer-motion";

export function Overline({ children, className = "" }) {
  return <div className={`overline ${className}`}>{children}</div>;
}

export function Panel({ children, className = "", clip = false, ...rest }) {
  return (
    <div
      className={`bg-surface/80 border border-[#27272a] ${clip ? "clip-corner" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

const variants = {
  primary:
    "bg-cyan text-void font-bold border border-cyan hover:brightness-110 shadow-[0_0_18px_rgba(0,240,255,0.35)]",
  volt: "bg-volt text-void font-bold border border-volt hover:brightness-110",
  ghost: "bg-transparent text-[#fafafa] border border-[#3f3f46] hover:border-cyan hover:text-cyan",
  danger: "bg-transparent text-[#ff0055] border border-[#ff0055]/40 hover:bg-[#ff0055]/10",
};

export function Btn({ children, variant = "ghost", className = "", size = "md", ...rest }) {
  const sz = size === "sm" ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm";
  return (
    <motion.button
      whileHover={{ scale: rest.disabled ? 1 : 1.02 }}
      whileTap={{ scale: rest.disabled ? 1 : 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-sm font-sans uppercase tracking-wider transition-[filter,border-color,color,background-color] duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sz} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-4">
      {label && <span className="overline block mb-2">{label}</span>}
      {children}
    </label>
  );
}

const controlCls =
  "w-full bg-void border border-[#27272a] rounded-sm px-3 py-2.5 text-[#fafafa] text-sm font-sans placeholder:text-[#52525b] focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors";

export function Input(props) {
  return <input {...props} className={`${controlCls} ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`${controlCls} appearance-none pr-9 cursor-pointer ${props.className ?? ""}`}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan"
        width="12"
        height="8"
        viewBox="0 0 12 8"
        fill="none"
      >
        <path
          d="M1 1l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Stat({ value, label, accent = "cyan" }) {
  const color = accent === "volt" ? "text-volt" : "text-cyan";
  return (
    <div className="p-5 bg-void/40">
      <div className={`font-mono text-2xl sm:text-3xl leading-none ${color}`}>{value}</div>
      <div className="overline mt-2">{label}</div>
    </div>
  );
}
