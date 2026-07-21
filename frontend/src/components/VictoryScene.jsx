import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import * as THREE from "three";

const CYAN = "#00f0ff";
const VOLT = "#dfff00";

// Procedural "trophy" — an icosahedron crystal (no external 3D model needed)
// with an emissive material for the glow, plus a wireframe shell riding
// slightly outside it for a faceted, cut-gem look. Spins slowly on its own
// (independent of any camera orbit) unless reduced-motion is on, in which
// case it just sits still — same discipline as the card's holo tilt.
function TrophyCrystal({ spin }) {
  const meshRef = useRef(null);
  useFrame((_, delta) => {
    if (!spin || !meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.4;
    meshRef.current.rotation.x = Math.sin(Date.now() / 2000) * 0.15;
  });

  return (
    <group ref={meshRef} position={[0, 0.6, 0]}>
      <mesh>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial
          color={VOLT}
          emissive={VOLT}
          emissiveIntensity={0.55}
          metalness={0.3}
          roughness={0.15}
        />
      </mesh>
      <mesh scale={1.04}>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// A slim ring "pedestal" beneath the crystal, plus a wide flat glow disc —
// gives the floating crystal a sense of a base without modeling an actual
// cup/podium.
function Pedestal() {
  return (
    <>
      <mesh position={[0, -0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color={CYAN} side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 48]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// Sparks drifting upward past the crystal, looping once they clear the top —
// a plain THREE.Points cloud with per-particle Y reset in the frame loop,
// cheaper than any particle library for a few dozen points.
function Sparks({ active }) {
  const count = 90;
  const pointsRef = useRef(null);
  const speeds = useMemo(() => Float32Array.from({ length: count }, () => 0.3 + Math.random() * 0.6), []);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 3.2;
      arr[i * 3 + 1] = Math.random() * 3.5 - 1.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!active || !pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = posAttr.getY(i) + speeds[i] * delta;
      if (y > 2) y = -1.5;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={VOLT} size={0.035} transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

function Scene({ spin }) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[3, 3, 3]} intensity={40} color={CYAN} />
      <pointLight position={[-3, -1, 2]} intensity={25} color={VOLT} />
      <Stars radius={30} depth={20} count={800} factor={2} saturation={0} fade speed={spin ? 0.3 : 0} />
      <Float speed={spin ? 1.4 : 0} rotationIntensity={spin ? 0.3 : 0} floatIntensity={spin ? 0.6 : 0}>
        <TrophyCrystal spin={spin} />
      </Float>
      <Pedestal />
      <Sparks active={spin} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={spin}
        autoRotateSpeed={0.8}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.7}
      />
    </>
  );
}

// Feature-detect WebGL before ever mounting <Canvas> — a headless/locked-down
// environment or an ancient browser throwing mid-render is a much worse
// failure mode than just not offering the 3D view at all.
function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export function VictoryScene({ championName, onClose }) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const [supported] = useState(webglAvailable);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portaled straight to <body> — App.jsx's <main> is `position: relative`
  // with its own z-10, which creates a stacking context that traps any
  // z-index set on a descendant no matter how high (confirmed live: with a
  // plain z-[200] div rendered inline here, the header's z-40 language
  // switcher still received clicks meant for this scene's close button,
  // since z-index only competes within the same stacking context). A
  // portal escapes <main> entirely so this really is on top of everything.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-void/95 backdrop-blur-md flex flex-col items-center justify-center"
      data-testid="victory-scene"
    >
      <button
        type="button"
        onClick={onClose}
        data-testid="victory-scene-close"
        aria-label={t("tour.trophyClose")}
        className="absolute top-5 right-5 w-10 h-10 border border-[#27272a] rounded-sm text-[#a1a1aa] hover:text-cyan hover:border-cyan transition-colors text-xl"
      >
        ×
      </button>

      <div className="w-full max-w-2xl aspect-square max-h-[60vh]">
        {supported ? (
          <Canvas camera={{ position: [0, 0.4, 4.2], fov: 45 }} dpr={[1, 1.75]}>
            <Scene spin={!reducedMotion} />
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-volt text-8xl">★</span>
          </div>
        )}
      </div>

      <div className="text-center -mt-4">
        <div className="overline text-volt">{t("tour.champion")}</div>
        <h2 className="font-display font-black text-4xl sm:text-5xl text-white tracking-tighter mt-2">
          {championName}
        </h2>
        {!reducedMotion && supported && (
          <p className="text-[#52525b] text-xs font-mono uppercase tracking-widest mt-4">
            {t("tour.trophyDragHint")}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
