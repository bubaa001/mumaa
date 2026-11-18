"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { ease } from "./motion";

/** A bottom sheet on phones, a centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease }}
          >
            <div className="sheet-head">
              <div>
                <span className="eyebrow">{eyebrow}</span>
                <h2 className="display" id={titleId}>{title}</h2>
                {description && <p>{description}</p>}
              </div>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
