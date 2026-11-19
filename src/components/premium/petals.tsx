"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const palette = ["#b4302a", "#d9574b", "#ef9a8f", "#f3dcd5", "#f5efe6"];

function createHeart() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.25);
  shape.bezierCurveTo(0, 0.5, -0.5, 0.55, -0.5, 0.15);
  shape.bezierCurveTo(-0.5, -0.15, -0.15, -0.3, 0, -0.5);
  shape.bezierCurveTo(0.15, -0.3, 0.5, -0.15, 0.5, 0.15);
  shape.bezierCurveTo(0.5, 0.55, 0, 0.5, 0, 0.25);
  const geometry = new THREE.ShapeGeometry(shape, 10);
  geometry.center();
  return geometry;
}

type Petal = {
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
  sway: number;
  phase: number;
  spin: number;
};

/** The spread of the view at z = 0 for a camera at z = 10 with a 50° field of view. */
const HALF_HEIGHT = 10 * Math.tan(THREE.MathUtils.degToRad(25));

function Hearts({ count, pointer }: { count: number; pointer: React.RefObject<{ x: number; y: number }> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(createHeart, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const petals = useMemo<Petal[]>(
    () =>
      Array.from({ length: count }, () => ({
        x: THREE.MathUtils.randFloatSpread(HALF_HEIGHT * 4),
        y: THREE.MathUtils.randFloatSpread(HALF_HEIGHT * 2.4),
        z: THREE.MathUtils.randFloat(-5, 3),
        scale: THREE.MathUtils.randFloat(0.16, 0.48),
        speed: THREE.MathUtils.randFloat(0.18, 0.5),
        sway: THREE.MathUtils.randFloat(0.2, 0.8),
        phase: Math.random() * Math.PI * 2,
        spin: THREE.MathUtils.randFloat(0.2, 0.9) * (Math.random() > 0.5 ? 1 : -1),
      })),
    [count],
  );

  useEffect(() => {
    const color = new THREE.Color();
    petals.forEach((_, index) => mesh.current?.setColorAt(index, color.set(palette[index % palette.length])));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [petals]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const step = Math.min(delta, 0.05);
    petals.forEach((petal, index) => {
      petal.y += petal.speed * step;
      if (petal.y > HALF_HEIGHT * 1.3) {
        petal.y = -HALF_HEIGHT * 1.3;
        petal.x = THREE.MathUtils.randFloatSpread(HALF_HEIGHT * 4);
      }
      dummy.position.set(petal.x + Math.sin(time * petal.sway + petal.phase) * 0.6, petal.y, petal.z);
      dummy.rotation.set(Math.sin(time * 0.6 + petal.phase) * 0.5, time * petal.spin, Math.sin(time * 0.4 + petal.phase) * 0.35);
      dummy.scale.setScalar(petal.scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;

    // The whole field leans a little toward the cursor.
    if (group.current) {
      const target = pointer.current ?? { x: 0, y: 0 };
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, target.x * 0.22, 3, step);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -target.y * 0.12, 3, step);
    }
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0.82} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

/** Floating hearts for the story hero. Pauses itself whenever the hero is off screen. */
export default function Petals() {
  const wrapper = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(true);
  const [count] = useState(() => (window.innerWidth < 760 ? 26 : 56));

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (wrapper.current) observer.observe(wrapper.current);
    const move = (event: PointerEvent) => {
      pointer.current = { x: (event.clientX / window.innerWidth) * 2 - 1, y: (event.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", move);
    };
  }, []);

  return (
    <div className="hero-petals" ref={wrapper} aria-hidden="true">
      <Canvas
        flat
        dpr={[1, 1.5]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        fallback={null}
      >
        <Hearts count={count} pointer={pointer} />
      </Canvas>
    </div>
  );
}
