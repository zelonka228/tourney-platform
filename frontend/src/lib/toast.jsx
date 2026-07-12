import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Site-wide toast stack, bottom-right. Kinds reuse the same neon palette as
// everywhere else (volt = success, cyan = info, danger red = error) instead
// of inventing new colors. Auto-dismisses after 4s but stays up under a
// hovered/focused pointer, and can always be closed by hand.
const ToastContext = createContext(null);

const KIND_COLOR = {
  success: "#dfff00",
  info: "#00f0ff",
  error: "#ff0055",
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, kind = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, kind }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const api = useRef({
    success: (msg) => push(msg, "success"),
    error: (msg) => push(msg, "error"),
    info: (msg) => push(msg, "info"),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(340px,calc(100vw-2rem))]"
        data-testid="toast-viewport"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              role="status"
              data-testid={`toast-${toast.kind}`}
              className="flex items-center gap-2.5 bg-void border rounded-sm px-3.5 py-2.5"
              style={{
                borderColor: KIND_COLOR[toast.kind],
                boxShadow: `0 0 16px ${KIND_COLOR[toast.kind]}26`,
              }}
            >
              <span
                className="w-2 h-2 rotate-45 shrink-0"
                style={{ background: KIND_COLOR[toast.kind] }}
              />
              <span className="text-[#fafafa] text-sm flex-1">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="close"
                className="text-[#52525b] hover:text-white text-base leading-none shrink-0"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
