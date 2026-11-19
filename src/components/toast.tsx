"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ease } from "./motion";

const ToastContext = createContext<(message: string) => void>(() => {});

/** A small confirmation that something was saved, edited, or deleted. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        <AnimatePresence>
          {message && (
            <motion.div
              className="toast"
              key={message.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.35, ease }}
            >
              <Check aria-hidden="true" /> {message.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
