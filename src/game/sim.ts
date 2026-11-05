import { sfxFull, sfxHeart, sfxHit, sfxOver, sfxTakeoff, unlockAudio } from "@/game/audio";

export type Kind = "heart" | "storm" | "crow";
export type Status = "menu" | "play" | "pause" | "over";

export type Entity = {
  kind: Kind;
  x: number;
  y: number;
  z: number;
  phase: number;
  alive: boolean;
};

export type Bit = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  good: boolean;
};

export type Pop = {
  id: number;
  text: string;
  good: boolean;
  born: number;
};

export type Snapshot = {
  love: number;
  missing: number;
  hearts: number;
  best: number;
  combo: number;
  status: Status;
  pops: Pop[];
  hint: boolean;
  full: boolean;
};

const SAVE = "lovewing.v1";

export const entities: Entity[] = Array.from({ length: 16 }, (_, i) => ({
  kind: "heart" as Kind,
  x: 0,
  y: 12,
  z: -24,
  phase: i * 0.7,
  alive: true,
}));

export const clouds: Entity[] = Array.from({ length: 14 }, (_, i) => ({
  kind: "storm" as Kind,
  x: 0,
  y: 2,
  z: -20,
  phase: i,
  alive: true,
}));

export const bits: Bit[] = Array.from({ length: 36 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  max: 1,
  good: true,
}));

export const keys = new Set<string>();

export const input = {
  steer: 0,
  pitch: 0,
  pointer: false,
};

export const visualEls: { flash: HTMLDivElement | null } = { flash: null };

const flightRoute: Array<{ kind: Kind; side: number; height: number }> = [
  { kind: "heart", side: -1.8, height: 12 },
  { kind: "storm", side: -1.4, height: 12.8 },
  { kind: "heart", side: 4.8, height: 15.2 },
  { kind: "crow", side: 1.5, height: 11 },
  { kind: "heart", side: 0, height: 14.6 },
  { kind: "storm", side: 4.6, height: 10.5 },
  { kind: "heart", side: -4.6, height: 16 },
  { kind: "crow", side: 0, height: 13 },
];

export const sim = {
  yaw: 0,
  pitch: 0,
  pitchSm: 0,
  roll: 0,
  steer: 0,
  x: 0,
  y: 12,
  z: 0,
  speed: 0,
  love: 58,
  hearts: 0,
  combo: 0,
  bestHearts: 0,
  status: "menu" as Status,
  time: 0,
  trauma: 0,
  hitstop: 0,
  flash: 0,
  lastHeart: -10,
  celebrated: false,
  showHint: true,
  popId: 1,
  pops: [] as Pop[],
};

let steerOverride: number | null = null;
let reducedMotion = false;
let routeIndex = 0;

let lastLove = 58;
let lastHearts = 0;
let lastStatus: Status = "menu";
let lastCombo = 0;
let lastPopId = 0;
let lastHint = true;
let lastFull = false;
let lastBest = 0;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function toSnap(): Snapshot {
  const love = Math.round(sim.love);
  return {
    love,
    missing: 100 - love,
    hearts: sim.hearts,
    best: sim.bestHearts,
    combo: sim.combo,
    status: sim.status,
    pops: sim.pops,
    hint: sim.showHint,
    full: love >= 100,
  };
}

let snap: Snapshot = toSnap();
const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnap() {
  return snap;
}

function publish() {
  snap = toSnap();
  lastLove = snap.love;
  lastHearts = snap.hearts;
  lastStatus = snap.status;
  lastCombo = snap.combo;
  lastPopId = snap.pops.length ? snap.pops[snap.pops.length - 1]!.id : 0;
  lastHint = snap.hint;
  lastFull = snap.full;
  lastBest = snap.best;
  listeners.forEach((fn) => fn());
}

function maybePublish() {
  const love = Math.round(sim.love);
  const popId = sim.pops.length ? sim.pops[sim.pops.length - 1]!.id : 0;
  const full = love >= 100;
  if (
    love !== lastLove ||
    sim.hearts !== lastHearts ||
    sim.status !== lastStatus ||
    sim.combo !== lastCombo ||
    popId !== lastPopId ||
    sim.pops.length !== snap.pops.length ||
    sim.showHint !== lastHint ||
    full !== lastFull ||
    sim.bestHearts !== lastBest
  ) {
    publish();
  }
}

function hBasis(yaw: number) {
  return {
    fx: -Math.sin(yaw),
    fz: -Math.cos(yaw),
    rx: Math.cos(yaw),
    rz: -Math.sin(yaw),
  };
}

function placeAhead(e: Entity, minA: number, maxA: number) {
  const ahead = minA + Math.random() * (maxA - minA);
  const route = flightRoute[routeIndex++ % flightRoute.length]!;
  const side = route.side + (Math.random() * 2 - 1) * 0.8;
  const b = hBasis(sim.yaw);
  e.x = sim.x + b.fx * ahead + b.rx * side;
  e.z = sim.z + b.fz * ahead + b.rz * side;
  e.y = route.height + (Math.random() * 2 - 1) * 0.8;
  e.phase = Math.random() * Math.PI * 2;
  e.alive = true;
  e.kind = route.kind;
}

export function layoutMenu() {
  routeIndex = 0;
  sim.x = 0;
  sim.y = 12;
  sim.z = 0;
  sim.yaw = 0;
  sim.pitch = 0;
  sim.pitchSm = 0;
  sim.roll = 0;
  sim.steer = 0;
  sim.speed = 0;
  entities.forEach((e, i) => {
    const col = (i % 5) - 2;
    const row = Math.floor(i / 5);
    e.kind = i % 6 === 0 ? "storm" : i % 5 === 4 ? "crow" : "heart";
    e.x = col * 6.4;
    e.y = 9.2 + (i % 3) * 2.6;
    e.z = -16 - row * 11;
    e.alive = true;
    e.phase = i * 0.85;
  });
  clouds.forEach((c, i) => {
    c.x = ((i * 19) % 17) * 5 - 40;
    c.y = i % 2 === 0 ? 1.2 : 23;
    c.z = -8 - i * 13;
    c.alive = true;
    c.phase = i * 0.4;
  });
}

function layoutPlay() {
  routeIndex = 0;
  const b = hBasis(0);
  entities.forEach((e, i) => {
    const route = flightRoute[i % flightRoute.length]!;
    const ahead = 20 + i * 9.2;
    const side = route.side + (Math.random() * 2 - 1) * 0.5;
    e.kind = route.kind;
    e.x = b.fx * ahead + b.rx * side;
    e.z = b.fz * ahead + b.rz * side;
    e.y = route.height + (Math.random() * 2 - 1) * 0.5;
    e.alive = true;
    e.phase = i * 0.6;
  });
  routeIndex = entities.length % flightRoute.length;
  clouds.forEach((c, i) => {
    const ahead = 16 + ((i * 47) % 130);
    const side = ((i * 29) % 50) - 25;
    const b = hBasis(sim.yaw);
    c.x = sim.x + b.fx * ahead + b.rx * side;
    c.z = sim.z + b.fz * ahead + b.rz * side;
    c.y = i % 3 === 0 ? 0.7 : 23 + (i % 4);
    c.alive = true;
  });
}

function burst(x: number, y: number, z: number, good: boolean) {
  let n = good ? 10 : 8;
  for (const b of bits) {
    if (b.life > 0) continue;
    b.life = b.max = 0.38 + Math.random() * 0.32;
    b.x = x;
    b.y = y;
    b.z = z;
    const a = Math.random() * Math.PI * 2;
    const s = (good ? 4.5 : 6.5) + Math.random() * 5;
    b.vx = Math.cos(a) * s;
    b.vy = 2 + Math.random() * 5;
    b.vz = Math.sin(a) * s;
    b.good = good;
    if (--n <= 0) break;
  }
}

function pushPop(text: string, good: boolean) {
  sim.popId += 1;
  sim.pops = [...sim.pops, { id: sim.popId, text, good, born: sim.time }].slice(-3);
}

function agePops() {
  if (!sim.pops.length) return;
  const next = sim.pops.filter((p) => sim.time - p.born < 0.95);
  if (next.length !== sim.pops.length) sim.pops = next;
}

function rememberBest() {
  if (sim.hearts <= sim.bestHearts) return;
  sim.bestHearts = sim.hearts;
  try {
    localStorage.setItem(SAVE, JSON.stringify({ best: sim.bestHearts }));
  } catch {
    /* private mode */
  }
}

function endRun() {
  if (sim.status !== "play") return;
  sim.status = "over";
  sim.speed = 0;
  rememberBest();
  sfxOver();
  publish();
}

function addLove(n: number) {
  sim.love = clamp(sim.love + n, 0, 100);
  if (sim.love >= 100 && !sim.celebrated) {
    sim.celebrated = true;
    sfxFull();
    pushPop("Full heart", true);
  }
  if (sim.love < 99.5) sim.celebrated = false;
  if (sim.love <= 0) {
    sim.love = 0;
    endRun();
  }
}

function radiusFor(kind: Kind) {
  if (kind === "heart") return 2.55;
  if (kind === "storm") return 2.75;
  return 1.9;
}

function onHeart(e: Entity) {
  const now = sim.time;
  sim.combo = now - sim.lastHeart < 2.6 ? sim.combo + 1 : 1;
  sim.lastHeart = now;
  const gain = 8 + Math.min(sim.combo, 6);
  sim.hearts += 1;
  rememberBest();
  addLove(gain);
  sim.trauma = Math.min(1, sim.trauma + (reducedMotion ? 0 : 0.16));
  sim.flash = Math.max(sim.flash, 0.28);
  sim.hitstop = 0.04;
  burst(e.x, e.y, e.z, true);
  pushPop(`+${gain}`, true);
  sfxHeart(sim.combo);
  placeAhead(e, 58, 112);
}

function onBad(e: Entity) {
  const loss = e.kind === "storm" ? 14 : 10;
  sim.combo = 0;
  addLove(-loss);
  sim.trauma = Math.min(1, sim.trauma + (reducedMotion ? 0 : 0.55));
  sim.flash = Math.max(sim.flash, 0.72);
  sim.hitstop = 0.08;
  burst(e.x, e.y, e.z, false);
  placeAhead(e, 64, 120);
  if (sim.status !== "play") return;
  pushPop(`−${loss}`, false);
  sfxHit();
}

export function loadBest() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { best?: number };
    if (typeof parsed.best === "number" && Number.isFinite(parsed.best)) {
      sim.bestHearts = parsed.best;
      publish();
    }
  } catch {
    /* ignore */
  }
}

export function hideHint() {
  if (!sim.showHint) return;
  sim.showHint = false;
  publish();
}

export function startRun() {
  unlockAudio();
  sim.love = 58;
  sim.hearts = 0;
  sim.combo = 0;
  sim.lastHeart = -10;
  sim.celebrated = false;
  sim.trauma = 0;
  sim.hitstop = 0;
  sim.flash = 0;
  sim.pops = [];
  sim.showHint = true;
  sim.x = 0;
  sim.y = 12;
  sim.z = 0;
  sim.yaw = 0;
  sim.pitch = 0;
  sim.pitchSm = 0;
  sim.roll = 0;
  sim.steer = 0;
  sim.speed = 18;
  sim.time = 0;
  sim.status = "play";
  input.steer = 0;
  input.pitch = 0;
  input.pointer = false;
  steerOverride = null;
  layoutPlay();
  sfxTakeoff();
  publish();
}

export function pauseToggle() {
  if (sim.status === "play") sim.status = "pause";
  else if (sim.status === "pause") sim.status = "play";
  publish();
}

export function backToMenu() {
  sim.status = "menu";
  sim.speed = 0;
  sim.pops = [];
  input.pointer = false;
  layoutMenu();
  publish();
}

function readPad() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) {
    return { steer: 0, pitch: 0 };
  }
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const mag = Math.hypot(x, y);
    const dz = 0.18;
    if (mag < dz) continue;
    const scale = (mag - dz) / ((1 - dz) * mag);
    // Stick left is negative X; left must be positive steer. Stick up is negative Y.
    return { steer: clamp(-x * scale, -1, 1), pitch: clamp(-y * scale, -1, 1) };
  }
  return { steer: 0, pitch: 0 };
}

function readSteer() {
  if (steerOverride !== null) return clamp(steerOverride, -1, 1);
  // A / swipe left → +steer → +yaw → nose left from the chase camera.
  let steer = input.pointer ? input.steer : 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
  steer += readPad().steer;
  return clamp(steer, -1, 1);
}

function readPitch() {
  let pitch = input.pointer ? input.pitch : 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) pitch += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) pitch -= 1;
  pitch += readPad().pitch;
  return clamp(pitch, -1, 1);
}

function recycleList(list: Entity[], minA: number, maxA: number, lat: number, decor: boolean) {
  const b = hBasis(sim.yaw);
  for (const e of list) {
    const dx = e.x - sim.x;
    const dz = e.z - sim.z;
    const along = dx * b.fx + dz * b.fz;
    const dist = Math.hypot(dx, e.y - sim.y, dz);
    if (along >= -12 && dist <= 175) continue;
    if (decor) {
      const ahead = minA + Math.random() * (maxA - minA);
      const side = (Math.random() * 2 - 1) * lat;
      const basis = hBasis(sim.yaw);
      e.x = sim.x + basis.fx * ahead + basis.rx * side;
      e.z = sim.z + basis.fz * ahead + basis.rz * side;
      e.y = Math.random() < 0.45 ? 0.5 + Math.random() * 2 : 22 + Math.random() * 7;
    } else {
      placeAhead(e, minA, maxA);
    }
  }
}

function collisions() {
  const cp = Math.cos(sim.pitch);
  const fx = -Math.sin(sim.yaw) * cp;
  const fy = Math.sin(sim.pitch);
  const fz = -Math.cos(sim.yaw) * cp;
  for (const e of entities) {
    if (!e.alive) continue;
    const dx = e.x - sim.x;
    const dy = e.y - sim.y;
    const dz = e.z - sim.z;
    const along = dx * fx + dy * fy + dz * fz;
    if (along < -1.4 || along > 5.8) continue;
    if (Math.hypot(dx, dy, dz) > radiusFor(e.kind)) continue;
    if (e.kind === "heart") onHeart(e);
    else onBad(e);
    if (sim.status !== "play") return;
  }
}

export function step(rawDt: number) {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  sim.time += dt;
  if (!reducedMotion) sim.trauma = Math.max(0, sim.trauma - dt * 1.35);
  else sim.trauma = 0;
  sim.flash = Math.max(0, sim.flash - dt * 1.7);
  if (visualEls.flash) {
    visualEls.flash.style.opacity = String(Math.min(0.48, sim.flash * 0.55));
  }

  for (const bit of bits) {
    if (bit.life <= 0) continue;
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.z += bit.vz * dt;
    bit.vy -= 8 * dt;
  }

  agePops();

  if (sim.hitstop > 0) {
    sim.hitstop -= dt;
    maybePublish();
    return;
  }

  if (sim.status !== "play") {
    maybePublish();
    return;
  }

  const steerTarget = readSteer();
  const pitchTarget = readPitch();
  sim.steer += (steerTarget - sim.steer) * (1 - Math.exp(-12 * dt));
  sim.pitchSm += (pitchTarget * 0.58 - sim.pitchSm) * (1 - Math.exp(-3.2 * dt));
  sim.pitch = sim.pitchSm;
  sim.yaw += sim.steer * 1.5 * dt;
  const bankTarget = sim.steer * 0.92;
  sim.roll += (bankTarget - sim.roll) * (1 - Math.exp(-7 * dt));
  sim.speed += (28 - sim.speed) * (1 - Math.exp(-2.4 * dt));

  const cp = Math.cos(sim.pitch);
  const fx = -Math.sin(sim.yaw) * cp;
  const fy = Math.sin(sim.pitch);
  const fz = -Math.cos(sim.yaw) * cp;
  sim.x += fx * sim.speed * dt;
  sim.y += fy * sim.speed * dt;
  sim.z += fz * sim.speed * dt;
  if (sim.y < 5) {
    sim.y = 5;
    if (sim.pitchSm < 0) sim.pitchSm *= 0.82;
  } else if (sim.y > 22) {
    sim.y = 22;
    if (sim.pitchSm > 0) sim.pitchSm *= 0.82;
  }

  if (sim.love < 100) {
    sim.love = Math.max(0, sim.love - 1.7 * dt);
    if (sim.love <= 0) {
      sim.love = 0;
      endRun();
      return;
    }
  }

  if (sim.combo > 0 && sim.time - sim.lastHeart > 2.6) sim.combo = 0;

  recycleList(entities, 50, 116, 16, false);
  recycleList(clouds, 24, 150, 56, true);
  collisions();
  maybePublish();
}

export function setKeys(codes: string[]) {
  keys.clear();
  steerOverride = null;
  for (const code of codes) keys.add(code);
}

export function setSteer(v: number) {
  steerOverride = v;
}

export function installProbe() {
  window.__controlsTest = {
    getYaw: () => sim.yaw,
    getSpeed: () => sim.speed,
    setKeys,
    setSteer,
  };
}

let booted = false;

export function bootLoop() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let last = performance.now();
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const dt = (now - last) / 1000;
    last = now;
    step(dt);
  };
  requestAnimationFrame(tick);
}

layoutMenu();

if (typeof window !== "undefined") {
  installProbe();
  bootLoop();
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
  }
}
