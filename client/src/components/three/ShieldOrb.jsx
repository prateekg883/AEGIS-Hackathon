import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ── Inner distorted glowing sphere ─────────────────── */
function GlowSphere() {
  const meshRef = useRef();
  const matRef = useRef();
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.18;
      meshRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.08;
    }
    if (matRef.current) {
      matRef.current.distort = 0.28 + Math.sin(clock.elapsedTime * 0.7) * 0.08;
    }
  });
  return (
    <Sphere ref={meshRef} args={[1.05, 64, 64]}>
      <MeshDistortMaterial
        ref={matRef}
        color="#00d4ff"
        emissive="#0055aa"
        emissiveIntensity={0.6}
        metalness={0.9}
        roughness={0.1}
        distort={0.3}
        speed={1.2}
        transparent
        opacity={0.85}
      />
    </Sphere>
  );
}

/* ── Orbiting ring ───────────────────────────────────── */
function Ring({ radius = 1.6, tilt = 0, speed = 0.4, color = '#00d4ff' }) {
  const ringRef = useRef();
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * speed;
    }
  });
  const geometry = useMemo(() => new THREE.TorusGeometry(radius, 0.012, 8, 100), [radius]);
  return (
    <mesh ref={ringRef} rotation={[tilt, 0, 0]} geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

/* ── Floating data nodes ─────────────────────────────── */
function DataNode({ position, delay = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.1 + delay) * 0.12;
      ref.current.rotation.y = clock.elapsedTime * 0.6;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.06, 0]} />
      <meshStandardMaterial
        color="#a855f7"
        emissive="#6600cc"
        emissiveIntensity={1.2}
        metalness={0.8}
        roughness={0.1}
      />
    </mesh>
  );
}

/* ── Scene ───────────────────────────────────────────── */
function Scene() {
  const nodePositions = useMemo(() => [
    [1.5, 0.4, 0.3], [-1.6, -0.2, 0.1], [0.2, 1.6, -0.4],
    [-0.3, -1.7, 0.2], [1.2, -1.1, 0.5], [-1.1, 1.2, -0.3],
  ], []);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={1.5} color="#00d4ff" />
      <pointLight position={[-3, -2, -2]} intensity={0.8} color="#a855f7" />
      <pointLight position={[0, -3, 2]} intensity={0.5} color="#3b82f6" />
      <Stars radius={60} depth={40} count={800} factor={2} saturation={0.5} fade speed={0.5} />
      <GlowSphere />
      <Ring radius={1.65} tilt={Math.PI / 2.5} speed={0.35} color="#00d4ff" />
      <Ring radius={1.85} tilt={Math.PI / 6}  speed={-0.22} color="#a855f7" />
      <Ring radius={2.1}  tilt={Math.PI / 3.5} speed={0.18} color="#3b82f6" />
      {nodePositions.map((pos, i) => (
        <DataNode key={i} position={pos} delay={i * 1.1} />
      ))}
    </>
  );
}

/* ── Exported canvas component ───────────────────────── */
export default function ShieldOrb({ size = 340 }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 1.6}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
