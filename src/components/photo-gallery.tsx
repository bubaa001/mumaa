"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ease } from "./motion";

type Photo = { src: string; alt: string };

/** A memory's photographs, opening into a full-screen viewer you can swipe through. */
export function PhotoGallery({ photos, caption }: { photos: Photo[]; caption: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="gallery">
        {photos.map((photo, index) => (
          <button className="gallery-item" type="button" key={photo.src} onClick={() => setOpen(index)} aria-label={`Open photograph ${index + 1} of ${photos.length}`}>
            <img src={photo.src} alt={photo.alt} loading={index > 1 ? "lazy" : undefined} decoding="async" />
          </button>
        ))}
      </div>
      <AnimatePresence>
        {open !== null && <Viewer photos={photos} start={open} caption={caption} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </>
  );
}

function Viewer({ photos, start, caption, onClose }: { photos: Photo[]; start: number; caption: string; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [[index, direction], setPage] = useState<[number, number]>([start, 0]);
  const count = photos.length;

  const go = useCallback(
    (step: number) => setPage(([current]) => [(current + step + count) % count, step]),
    [count],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose]);

  // Warm the neighbours so swiping never waits on a download.
  useEffect(() => {
    [index + 1, index - 1].forEach((n) => {
      const image = new Image();
      image.src = photos[(n + count) % count].src;
    });
  }, [index, photos, count]);

  const slide = reduce ? 0 : 60;

  return (
    <motion.div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="viewer-top">
        <span className="viewer-count">{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
        <button className="viewer-btn" type="button" onClick={onClose} aria-label="Close">
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="viewer-stage" onClick={(event) => event.target === event.currentTarget && onClose()}>
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={photos[index].src}
            src={photos[index].src}
            alt={photos[index].alt}
            className="viewer-image"
            custom={direction}
            initial={{ opacity: 0, x: direction * slide, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -slide, scale: 0.98 }}
            transition={{ duration: 0.45, ease }}
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -400) go(1);
              else if (info.offset.x > 70 || info.velocity.x > 400) go(-1);
            }}
            draggable={false}
          />
        </AnimatePresence>
      </div>

      <div className="viewer-bottom">
        <p>{caption}</p>
        {count > 1 && (
          <div className="viewer-nav">
            <button className="viewer-btn" type="button" onClick={() => go(-1)} aria-label="Previous photograph">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button className="viewer-btn" type="button" onClick={() => go(1)} aria-label="Next photograph">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
