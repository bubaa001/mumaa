import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bits, clouds, entities, sim } from "@/game/sim";

const _fwd = new THREE.Vector3();
const _look = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _target = new THREE.Vector3();

function makeHeartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.35);
  shape.bezierCurveTo(0, 0.85, -0.95, 0.82, -0.95, 0.12);
  shape.bezierCurveTo(-0.95, -0.38, 0, -0.55, 0, -1.2);
  shape.bezierCurveTo(0, -0.55, 0.95, -0.38, 0.95, 0.12);
  shape.bezierCurveTo(0.95, 0.82, 0, 0.85, 0, 0.35);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.32,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

function useGlowMap() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext("2d");
    if (!g) return null;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,214,220,0.95)");
    grd.addColorStop(1, "rgba(255,214,220,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function SkyDome() {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 512;
    const g = canvas.getContext("2d");
    if (!g) return null;
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, "#10182c");
    grd.addColorStop(0.34, "#243456");
    grd.addColorStop(0.58, "#b85d58");
    grd.addColorStop(0.74, "#f3b183");
    grd.addColorStop(1, "#f7dcc0");
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    ref.current?.position.set(sim.x, 6, sim.z);
  });
  if (!map) return null;
  return (
    <mesh ref={ref} scale={[-1, 1, 1]}>
      <sphereGeometry args={[340, 28, 18]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function Sun() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    ref.current?.position.set(sim.x + 55, 14, sim.z - 120);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[11, 18, 14]} />
      <meshBasicMaterial color="#ffe3c4" />
    </mesh>
  );
}

function Plane() {
  const ref = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const cream = useMemo(() => new THREE.MeshLambertMaterial({ color: "#f7f1e6" }), []);
  const wine = useMemo(() => new THREE.MeshLambertMaterial({ color: "#6b2a42" }), []);
  const navy = useMemo(() => new THREE.MeshLambertMaterial({ color: "#1a2236" }), []);
  const rose = useMemo(() => new THREE.MeshLambertMaterial({ color: "#e23e63" }), []);
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: "#141820" }), []);
  const propMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#f3eadc" }), []);

  useFrame((_, dt) => {
    const group = ref.current;
    if (!group) return;
    const idle = sim.status === "play" ? 0 : Math.sin(sim.time * 1.15) * 0.16;
    group.position.set(sim.x, sim.y + idle, sim.z);
    const cp = Math.cos(sim.pitch);
    _fwd.set(-Math.sin(sim.yaw) * cp, Math.sin(sim.pitch), -Math.cos(sim.yaw) * cp);
    _look.copy(group.position).add(_fwd);
    group.lookAt(_look);
    group.rotateZ(sim.roll);
    if (prop.current) prop.current.rotation.z += dt * (22 + sim.speed);
  });

  return (
    <group ref={ref} scale={1.2}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={wine} position={[0, 0, 0.05]}>
        <capsuleGeometry args={[0.22, 1.7, 5, 12]} />
      </mesh>
      <mesh material={rose} position={[0, 0.1, 0.12]}>
        <boxGeometry args={[0.12, 0.05, 1.4]} />
      </mesh>
      <mesh material={navy} position={[0, 0.46, 0.16]}>
        <boxGeometry args={[3.75, 0.08, 0.66]} />
      </mesh>
      <mesh material={cream} position={[0, 0.52, 0.16]}>
        <boxGeometry args={[3.35, 0.045, 0.46]} />
      </mesh>
      <mesh material={navy} position={[0, -0.32, 0.1]}>
        <boxGeometry args={[2.75, 0.07, 0.52]} />
      </mesh>
      <mesh material={cream} position={[0, -0.26, 0.1]}>
        <boxGeometry args={[2.4, 0.04, 0.36]} />
      </mesh>
      <mesh material={rose} position={[1.72, 0.5, 0.16]}>
        <boxGeometry args={[0.32, 0.08, 0.42]} />
      </mesh>
      <mesh material={rose} position={[-1.72, 0.5, 0.16]}>
        <boxGeometry args={[0.32, 0.08, 0.42]} />
      </mesh>
      <mesh material={rose} position={[0.72, 0.1, 0.16]}>
        <boxGeometry args={[0.045, 0.72, 0.045]} />
      </mesh>
      <mesh material={rose} position={[-0.72, 0.1, 0.16]}>
        <boxGeometry args={[0.045, 0.72, 0.045]} />
      </mesh>
      <mesh material={wine} position={[0, 0.4, -0.98]}>
        <boxGeometry args={[0.06, 0.62, 0.34]} />
      </mesh>
      <mesh material={rose} position={[0, 0.66, -0.98]}>
        <boxGeometry args={[0.08, 0.16, 0.22]} />
      </mesh>
      <mesh material={wine} position={[0, 0.02, -1.05]}>
        <boxGeometry args={[1.25, 0.05, 0.3]} />
      </mesh>
      <mesh material={glass} position={[0, 0.28, 0.15]}>
        <sphereGeometry args={[0.2, 14, 10]} />
      </mesh>
      <mesh material={rose} position={[0, 0.02, 1.02]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.34, 12]} />
      </mesh>
      <group ref={prop} position={[0, 0.02, 1.18]}>
        <mesh material={propMat} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 0.025, 20]} />
        </mesh>
        <mesh material={propMat}>
          <boxGeometry args={[0.045, 1.05, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}

function Entities() {
  const heartGeo = useMemo(() => makeHeartGeometry(), []);
  const heartMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e23e63",
        emissive: "#ff5b82",
        emissiveIntensity: 0.55,
        roughness: 0.38,
        metalness: 0.04,
      }),
    [],
  );
  const stormMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: "#2e3a54", flatShading: true }),
    [],
  );
  const boltMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#f3d7a2" }), []);
  const crowMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#2a3148" }), []);
  const wingMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#3d465e" }), []);
  const glowMap = useGlowMap();
  const glowMat = useMemo(() => {
    if (!glowMap) return null;
    return new THREE.SpriteMaterial({
      map: glowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      toneMapped: false,
      color: "#ffb3c2",
    });
  }, [glowMap]);

  const roots = useRef<Array<THREE.Group | null>>([]);
  const hearts = useRef<Array<THREE.Group | null>>([]);
  const storms = useRef<Array<THREE.Group | null>>([]);
  const crows = useRef<Array<THREE.Group | null>>([]);
  const wingL = useRef<Array<THREE.Group | null>>([]);
  const wingR = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ camera }) => {
    const t = sim.time;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const root = roots.current[i];
      if (!e || !root) continue;
      const bob = Math.sin(t * 1.7 + e.phase) * 0.38;
      root.position.set(e.x, e.y + bob, e.z);
      const heart = hearts.current[i];
      const storm = storms.current[i];
      const crow = crows.current[i];
      if (heart) heart.visible = e.kind === "heart";
      if (storm) storm.visible = e.kind === "storm";
      if (crow) crow.visible = e.kind === "crow";
      if (e.kind === "heart" && heart) {
        heart.quaternion.copy(camera.quaternion);
        const s = 1 + Math.sin(t * 3 + e.phase) * 0.05;
        heart.scale.setScalar(s);
      }
      if (e.kind === "storm" && storm) storm.rotation.y = t * 0.2 + e.phase;
      if (e.kind === "crow" && crow) {
        crow.rotation.set(0, Math.atan2(sim.x - e.x, sim.z - e.z), 0);
        const flap = Math.sin(t * 10 + e.phase) * 0.55;
        const left = wingL.current[i];
        const right = wingR.current[i];
        if (left) left.rotation.z = 0.4 + flap;
        if (right) right.rotation.z = -0.4 - flap;
      }
    }
  });

  return (
    <group>
      {entities.map((e, i) => (
        <group key={i} ref={(node) => { roots.current[i] = node; }}>
          <group ref={(node) => { hearts.current[i] = node; }} visible={e.kind === "heart"}>
            <mesh geometry={heartGeo} material={heartMat} scale={1.15} />
            {glowMat ? <sprite material={glowMat} scale={[3.2, 3.2, 1]} /> : null}
          </group>
          <group ref={(node) => { storms.current[i] = node; }} visible={e.kind === "storm"} scale={1.25}>
            <mesh material={stormMat}>
              <sphereGeometry args={[1.05, 6, 5]} />
            </mesh>
            <mesh material={stormMat} position={[0.85, 0.25, 0.15]}>
              <sphereGeometry args={[0.72, 6, 5]} />
            </mesh>
            <mesh material={stormMat} position={[-0.72, 0.18, -0.1]}>
              <sphereGeometry args={[0.66, 6, 5]} />
            </mesh>
            <mesh material={boltMat} position={[0.1, -0.15, 0.4]} rotation={[0.2, 0, 0.4]}>
              <coneGeometry args={[0.12, 0.7, 4]} />
            </mesh>
          </group>
          <group ref={(node) => { crows.current[i] = node; }} visible={e.kind === "crow"} scale={1.15}>
            <mesh material={crowMat} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.16, 0.45, 3, 8]} />
            </mesh>
            <mesh material={crowMat} position={[0, -0.02, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.08, 0.28, 6]} />
            </mesh>
            <group ref={(node) => { wingL.current[i] = node; }} position={[-0.12, 0, 0]}>
              <mesh material={wingMat} position={[-0.42, 0, 0]}>
                <boxGeometry args={[0.85, 0.05, 0.32]} />
              </mesh>
            </group>
            <group ref={(node) => { wingR.current[i] = node; }} position={[0.12, 0, 0]}>
              <mesh material={wingMat} position={[0.42, 0, 0]}>
                <boxGeometry args={[0.85, 0.05, 0.32]} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

function Bits() {
  const glowMap = useGlowMap();
  const mats = useMemo(() => {
    if (!glowMap) return [];
    return bits.map(
      () =>
        new THREE.SpriteMaterial({
          map: glowMap,
          transparent: true,
          depthWrite: false,
          opacity: 0,
          toneMapped: false,
        }),
    );
  }, [glowMap]);
  const refs = useRef<Array<THREE.Sprite | null>>([]);

  useFrame(() => {
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i];
      const sprite = refs.current[i];
      const mat = mats[i];
      if (!bit || !sprite || !mat) continue;
      const alive = bit.life > 0;
      sprite.visible = alive;
      if (!alive) continue;
      sprite.position.set(bit.x, bit.y, bit.z);
      const k = Math.max(bit.life / bit.max, 0);
      const s = 0.45 + (1 - k) * 0.85;
      sprite.scale.setScalar(s);
      mat.opacity = k;
      if (bit.good) mat.color.setRGB(1, 0.55, 0.66);
      else mat.color.setRGB(0.62, 0.68, 0.82);
    }
  });

  if (!mats.length) return null;
  return (
    <group>
      {mats.map((mat, i) => (
        <sprite key={i} ref={(node) => { refs.current[i] = node; }} material={mat} visible={false} />
      ))}
    </group>
  );
}

function CloudField() {
  const mat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: "#f6e2cf",
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    [],
  );
  const refs = useRef<Array<THREE.Group | null>>([]);
  useFrame(() => {
    const t = sim.time;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const node = refs.current[i];
      if (!c || !node) continue;
      node.position.set(c.x, c.y + Math.sin(t * 0.3 + c.phase) * 0.3, c.z);
    }
  });
  return (
    <group>
      {clouds.map((c, i) => (
        <group key={i} ref={(node) => { refs.current[i] = node; }} position={[c.x, c.y, c.z]}>
          <mesh material={mat}>
            <sphereGeometry args={[3.2 + (i % 3), 8, 6]} />
          </mesh>
          <mesh material={mat} position={[2.2, 0.3, 0.4]}>
            <sphereGeometry args={[2.1, 8, 6]} />
          </mesh>
          <mesh material={mat} position={[-1.8, 0.2, -0.3]}>
            <sphereGeometry args={[1.8, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ChaseCam() {
  useFrame(({ camera }, dt) => {
    const hfx = -Math.sin(sim.yaw);
    const hfz = -Math.cos(sim.yaw);
    const rx = Math.cos(sim.yaw);
    const rz = -Math.sin(sim.yaw);
    const browsing = sim.status !== "play";
    const back = browsing ? 9.2 : 6.6;
    const camLift = browsing ? 0.35 : 2.05;
    const lookLift = browsing ? -2.8 : 0.55;
    const shake = sim.trauma * sim.trauma;
    _desired.set(sim.x, sim.y + camLift, sim.z);
    _desired.x += -hfx * back;
    _desired.z += -hfz * back;
    _desired.x += Math.sin(sim.time * 33) * shake * 0.38;
    _desired.y += Math.cos(sim.time * 29) * shake * 0.26;
    const k = 1 - Math.exp(-5.5 * dt);
    camera.position.lerp(_desired, k);
    _target.set(
      sim.x + hfx * 16,
      sim.y + lookLift + Math.sin(sim.pitch) * 4,
      sim.z + hfz * 16,
    );
    const cr = Math.cos(sim.roll);
    const sr = Math.sin(sim.roll);
    camera.up.set(rx * sr, cr, rz * sr);
    camera.lookAt(_target);
  });
  return null;
}

export function FlightCanvas() {
  return (
    <Canvas
      className="game-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.1, far: 520, position: [0, 15.2, 8.6] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#10182c");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
    >
      <fog attach="fog" args={["#e7a07a", 68, 210]} />
      <hemisphereLight args={["#ffd2b0", "#1b2744", 0.9]} />
      <ambientLight intensity={0.38} />
      <directionalLight position={[28, 36, -18]} intensity={1.55} color="#ffd0a8" />
      <SkyDome />
      <Sun />
      <CloudField />
      <Entities />
      <Bits />
      <Plane />
      <ChaseCam />
    </Canvas>
  );
}
