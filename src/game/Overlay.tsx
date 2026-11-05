import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Heart, Pause, Play } from "lucide-react";
import {
  backToMenu,
  bootLoop,
  getSnap,
  hideHint,
  input,
  installProbe,
  keys,
  loadBest,
  pauseToggle,
  sim,
  startRun,
  subscribe,
  visualEls,
} from "@/game/sim";

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function Overlay({ children }: { children?: ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  const originRef = useRef<HTMLDivElement>(null);
  const fingerRef = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    loadBest();
    installProbe();
    bootLoop();
    const down = (event: KeyboardEvent) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      keys.add(event.code);
      if (event.code === "Space" && (sim.status === "play" || sim.status === "pause")) {
        pauseToggle();
      }
    };
    const up = (event: KeyboardEvent) => {
      keys.delete(event.code);
    };
    const clear = () => keys.clear();
    const vis = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const showFinger = (x: number, y: number, on: boolean) => {
    const finger = fingerRef.current;
    const dot = originRef.current;
    if (!finger || !dot) return;
    finger.style.opacity = on ? "1" : "0";
    dot.style.opacity = on ? "1" : "0";
    if (!on) return;
    finger.style.left = `${x}px`;
    finger.style.top = `${y}px`;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, [data-ui]")) return;
    if (sim.status !== "play") return;
    active.current = event.pointerId;
    origin.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture can fail for a cancelled touch; steering still tracks moves */
    }
    input.pointer = true;
    input.steer = 0;
    input.pitch = 0;
    hideHint();
    const dot = originRef.current;
    if (dot) {
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
    }
    showFinger(event.clientX, event.clientY, true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerId !== active.current) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    const radius = 108;
    // Drag left → positive steer (same sign as A). Drag up → climb.
    input.steer = clamp(-dx / radius, -1, 1);
    input.pitch = clamp(-dy / radius, -1, 1);
    showFinger(event.clientX, event.clientY, true);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerId !== active.current) return;
    active.current = null;
    input.pointer = false;
    input.steer = 0;
    input.pitch = 0;
    showFinger(0, 0, false);
  };

  const playing = snap.status === "play" || snap.status === "pause";

  return (
    <div
      className="game-shell"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
      <div className="vignette" />
      <div ref={originRef} className="finger-origin" style={{ opacity: 0 }} />
      <div ref={fingerRef} className="finger" style={{ opacity: 0 }} />
      <div
        ref={(node) => {
          visualEls.flash = node;
        }}
        className="pointer-events-none absolute inset-0 bg-rose"
        style={{ opacity: 0 }}
      />

      {playing ? (
        <div className="hud-safe pointer-events-none absolute inset-0 z-10 flex flex-col">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] text-cream uppercase">
                  <Heart className="size-3.5 text-rose" aria-hidden />
                  Love
                </p>
                <p className="text-sm text-mist" aria-live="polite">
                  {snap.full ? "full heart" : `missing ${snap.missing}%`}
                </p>
              </div>
              <div
                className="meter-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={snap.love}
                aria-label="Love"
              >
                <div
                  className={snap.love < 30 && !snap.full ? "meter-fill meter-fill-low" : "meter-fill"}
                  style={{ width: `${snap.love}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className="display text-3xl text-cream">{snap.love}%</p>
                <p className="text-sm text-mist">
                  {snap.hearts} caught
                  {snap.best > 0 ? ` · best ${snap.best}` : ""}
                  {snap.combo > 1 ? ` · ×${snap.combo}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-ui="pause"
              className="icon-btn pointer-events-auto"
              aria-label={snap.status === "pause" ? "Resume" : "Pause"}
              onClick={() => pauseToggle()}
            >
              {snap.status === "pause" ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center">
            {snap.pops.map((pop) => (
              <span key={pop.id} className={pop.good ? "pop text-rose" : "pop text-horizon"}>
                {pop.text}
              </span>
            ))}
          </div>

          <div className="mt-auto text-center">
            {snap.hint ? (
              <p className="text-sm text-cream">Swipe anywhere to steer</p>
            ) : (
              <p className="text-xs tracking-wide text-mist">
                {snap.love < 30 ? "Love is slipping — find a heart" : "Hearts fill it · storms spend it"}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {snap.status === "pause" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/50">
          <div className="panel px-6 py-7 text-center">
            <p className="text-xs tracking-[0.22em] text-horizon uppercase">Holding</p>
            <h2 className="display mt-2 text-4xl">Paused</h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button type="button" className="btn-primary" onClick={() => pauseToggle()}>
                Resume
              </button>
              <button type="button" className="btn-quiet" onClick={() => backToMenu()}>
                Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {snap.status === "menu" ? (
        <div className="hud-safe absolute inset-x-0 bottom-0 z-20 flex justify-center">
          <div className="panel mb-1 px-5 py-5 text-center sm:px-7">
            <p className="text-xs tracking-[0.28em] text-horizon uppercase">Dusk flight</p>
            <h1 className="display mt-2 text-5xl text-cream">Lovewing</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-mist sm:text-base">
              Swipe to fly. Hearts raise your love. Storms and crows spend it. Miss them, and it fades.
            </p>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => startRun()}>
              Start
            </button>
            <p className="mt-2 text-xs text-mist">Swipe to steer · WASD · W climbs</p>
            {snap.best > 0 ? <p className="mt-1 text-sm text-horizon">Best catch {snap.best}</p> : null}
          </div>
        </div>
      ) : null}

      {snap.status === "over" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="panel px-6 py-7 text-center">
            <p className="text-xs tracking-[0.22em] text-horizon uppercase">The sky went quiet</p>
            <h2 className="display mt-3 text-5xl">Love ran out</h2>
            <p className="mt-3 text-mist">
              {snap.hearts} heart{snap.hearts === 1 ? "" : "s"} caught
              {snap.best > 0 ? ` · best ${snap.best}` : ""}
            </p>
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => startRun()}>
              Fly again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
