// Легкий toast-контекст для короткого фідбеку дій (успіх/помилка) — не
// заміняє inline-помилки біля конкретних форм (ті лишаються, дають деталь
// саме там, де людина дивиться), а доповнює для дій, результат яких інакше
// непомітний (успішне збереження, генерація сітки тощо).
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: { border: "border-cyan/60", dot: "bg-cyan" },
  error: { border: "border-arena-danger/60", dot: "bg-arena-danger" },
  info: { border: "border-[#3f3f46]", dot: "bg-[#a1a1aa]" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, variant = "info", duration = 3500) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const style = VARIANT_STYLES[t.variant] ?? VARIANT_STYLES.info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                onClick={() => dismiss(t.id)}
                className={`pointer-events-auto flex items-center gap-2.5 bg-surface/95 border ${style.border} rounded-sm px-4 py-3 shadow-lg backdrop-blur-sm max-w-sm cursor-pointer`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                <span className="text-sm text-white font-mono">{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// toast(message, "success" | "error" | "info")
export function useToast() {
  return useContext(ToastContext);
}
