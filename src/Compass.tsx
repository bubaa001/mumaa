import { useEffect, useMemo, useRef, useState } from "react";

type SensorState = "idle" | "requesting" | "active" | "relative" | "unsupported" | "denied";

const GOLD = "#dcb87b";
const NAVY = "#0b2340";

function normalizeHeading(value: number) {
  return (value + 360) % 360;
}

function smoothHeading(current: number, target: number, amount = 0.16) {
  const delta = ((target - current + 540) % 360) - 180;
  return normalizeHeading(current + delta * amount);
}

function headingFromQuaternion([x, y, z, w]: readonly number[]) {
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return normalizeHeading(360 - (yaw * 180) / Math.PI + screenOrientationAngle());
}

function screenOrientationAngle() {
  return typeof screen.orientation?.angle === "number"
    ? screen.orientation.angle
    : typeof window.orientation === "number"
      ? window.orientation
      : 0;
}

function directionForHeading(heading: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(heading / 45) % 8
  ];
}

function CompassDial({ heading }: { heading: number }) {
  const ticks = useMemo(
    () =>
      Array.from({ length: 72 }, (_, index) => {
        const angle = index * 5;
        const major = angle % 45 === 0;
        const outer = 142;
        const inner = major ? 123 : angle % 15 === 0 ? 130 : 135;
        const radians = (angle * Math.PI) / 180;
        return {
          angle,
          major,
          x1: 160 + Math.sin(radians) * inner,
          y1: 160 - Math.cos(radians) * inner,
          x2: 160 + Math.sin(radians) * outer,
          y2: 160 - Math.cos(radians) * outer,
        };
      }),
    [],
  );

  return (
    <div className="compass-dial-wrap" aria-hidden="true">
      <span className="compass-pointer" />
      <svg
        className="compass-dial"
        viewBox="0 0 320 320"
        role="img"
        style={{ transform: `rotate(${-heading}deg)` }}
      >
        <circle cx="160" cy="160" r="151" fill="none" stroke="rgba(220,184,123,.38)" />
        <circle cx="160" cy="160" r="113" fill="none" stroke="rgba(220,184,123,.16)" />
        {ticks.map((tick) => (
          <line
            key={tick.angle}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? GOLD : "rgba(255,255,255,.52)"}
            strokeWidth={tick.major ? 2 : 1}
          />
        ))}
        <text x="160" y="61" textAnchor="middle" className="compass-cardinal compass-north">N</text>
        <text x="259" y="166" textAnchor="middle" className="compass-cardinal">E</text>
        <text x="160" y="266" textAnchor="middle" className="compass-cardinal">S</text>
        <text x="61" y="166" textAnchor="middle" className="compass-cardinal">W</text>
        <circle cx="160" cy="160" r="5" fill={GOLD} />
      </svg>
    </div>
  );
}

export function Compass() {
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState(0);
  const [sensorState, setSensorState] = useState<SensorState>("idle");
  const headingRef = useRef(0);
  const sensorRef = useRef<{ stop?: () => void } | null>(null);
  const relativeAlphaRef = useRef<number | null>(null);
  const relativeOffsetRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    let active = true;
    let animationFrame = 0;
    let targetHeading = headingRef.current;
    let absoluteReadingReceived = false;
    let relativeFallbackTimer = 0;

    const updateHeading = (nextHeading: number) => {
      targetHeading = normalizeHeading(nextHeading);
      if (!animationFrame) {
        const animate = () => {
          headingRef.current = smoothHeading(headingRef.current, targetHeading);
          setHeading(headingRef.current);
          if (Math.abs(((targetHeading - headingRef.current + 540) % 360) - 180) > 0.05) {
            animationFrame = requestAnimationFrame(animate);
          } else {
            animationFrame = 0;
          }
        };
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const handleDeviceOrientationAbsolute = (
      event: DeviceOrientationEvent & { webkitCompassHeading?: number },
    ) => {
      absoluteReadingReceived = true;
      window.clearTimeout(relativeFallbackTimer);
      if (typeof event.webkitCompassHeading === "number") {
        updateHeading(event.webkitCompassHeading + screenOrientationAngle());
      } else if (typeof event.alpha === "number") {
        updateHeading(360 - event.alpha + screenOrientationAngle());
      }
    };

    const handleRelativeOrientation = (event: DeviceOrientationEvent) => {
      if (absoluteReadingReceived || typeof event.alpha !== "number") return;
      relativeAlphaRef.current = event.alpha;
      updateHeading(
        360 - event.alpha + relativeOffsetRef.current + screenOrientationAngle(),
      );
      setSensorState("relative");
    };

    const startAbsoluteOrientationEvent = () => {
      window.addEventListener(
        "deviceorientationabsolute",
        handleDeviceOrientationAbsolute as EventListener,
      );
      window.addEventListener("deviceorientation", handleRelativeOrientation);
      relativeFallbackTimer = window.setTimeout(() => {
        if (!absoluteReadingReceived && active) setSensorState("relative");
      }, 2000);
      setSensorState("active");
    };

    const startSensor = async () => {
      setSensorState("requesting");
      try {
        const AbsoluteSensor = (
          window as Window & {
            AbsoluteOrientationSensor?: new (options?: { frequency?: number }) => {
              quaternion: readonly number[] | null;
              addEventListener: (type: "reading", listener: () => void) => void;
              removeEventListener: (type: "reading", listener: () => void) => void;
              start: () => void;
              stop: () => void;
            };
          }
        ).AbsoluteOrientationSensor;

        if (AbsoluteSensor) {
          try {
            const sensor = new AbsoluteSensor({ frequency: 30 });
            const onReading = () => {
              if (sensor.quaternion) updateHeading(headingFromQuaternion(sensor.quaternion));
            };
            sensor.addEventListener("reading", onReading);
            sensor.start();
            sensorRef.current = { stop: () => { sensor.removeEventListener("reading", onReading); sensor.stop(); } };
            setSensorState("active");
            return;
          } catch {
            // Fall through to the absolute device-orientation event.
          }
        }

        const OrientationEvent = (
          window as Window & {
            DeviceOrientationEvent?: typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<"granted" | "denied">;
            };
          }
        ).DeviceOrientationEvent;
        if (!OrientationEvent) {
          if (active) setSensorState("unsupported");
          return;
        }
        if (OrientationEvent.requestPermission) {
          const permission = await OrientationEvent.requestPermission();
          if (permission !== "granted") throw new Error("Motion permission was denied.");
        }
        if (active) startAbsoluteOrientationEvent();
      } catch {
        if (active) setSensorState("denied");
      }
    };

    void startSensor();
    return () => {
      active = false;
      window.removeEventListener(
        "deviceorientationabsolute",
        handleDeviceOrientationAbsolute as EventListener,
      );
      window.removeEventListener("deviceorientation", handleRelativeOrientation);
      window.clearTimeout(relativeFallbackTimer);
      sensorRef.current?.stop?.();
      sensorRef.current = null;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
  }, [open]);

  const close = () => setOpen(false);
  const calibrateRelative = () => {
    if (relativeAlphaRef.current === null) return;
    relativeOffsetRef.current = relativeAlphaRef.current - screenOrientationAngle();
    setHeading(0);
    headingRef.current = 0;
  };
  const degrees = Math.round(heading).toString().padStart(3, "0");
  const status =
    sensorState === "requesting"
      ? "Requesting device orientation…"
      : sensorState === "relative"
        ? "Relative mode — True North is unavailable on this device"
      : sensorState === "active"
        ? "Point the top of your phone toward your heading"
        : sensorState === "denied"
          ? "Motion access is unavailable. Check your browser permissions."
          : "A compass sensor is not available on this device.";

  return (
    <>
      <button className="compass-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open Compass">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19.4 4.6-4.1 9.1-9.1 4.1 4.1-9.1 9.1-4.1Z" /><path d="m10.3 13.7 3.4-3.4" /></svg>
        Compass
      </button>
      {open && (
        <div className="compass-modal" role="dialog" aria-modal="true" aria-labelledby="compass-title">
          <div className="compass-modal-content">
            <button className="compass-close" type="button" onClick={close} aria-label="Close Compass">×</button>
            <p className="compass-kicker">NAVIGATION FOR US</p>
            <h2 id="compass-title">Compass</h2>
            <p className="compass-subtitle">Hold device flat</p>
            <CompassDial heading={heading} />
            <div className="compass-reading" aria-live="polite">
              <strong>{degrees}°</strong>
              <span>{directionForHeading(heading)}</span>
            </div>
            <p className="compass-status" role="status">{status}</p>
            <button
              className="compass-calibration"
              type="button"
              onClick={calibrateRelative}
              disabled={sensorState !== "relative" || relativeAlphaRef.current === null}
            >
              Figure-8 Calibration
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export { GOLD, NAVY };
