import { Canvas, useFrame } from "@react-three/fiber";
import { Cylinder, Tube, Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type { Group, Mesh, ShaderMaterial } from "three";
import * as THREE from "three";

/**
 * Sartex Digital Twin — Industrial dosing rig.
 *
 * A transparent stainless-steel mixing tank (cuve T-01) sits at the centre.
 * Eight chemical dosing lines descend from an overhead manifold, each
 * coloured to match one of the PLC product bits (M100..M800). Coloured
 * droplets travel down the pipes and splash into the swirling indigo
 * denim bath below. A slow agitator rotates inside the tank.
 */

/* ---------- Swirling liquid shader (indigo denim bath) ---------- */

const liquidVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const liquidFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;
  uniform float uActivity;

  // simple 2D hash noise
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    // swirl coordinates
    float angle = uTime * 0.35;
    vec2 c = uv - 0.5;
    float r = length(c);
    float a = atan(c.y, c.x) + angle + r * 3.0;
    vec2 sw = vec2(cos(a), sin(a)) * r + 0.5;

    float n = noise(sw * 6.0 + uTime * 0.4);
    float n2 = noise(sw * 14.0 - uTime * 0.6);

    vec3 deep    = vec3(0.02, 0.05, 0.20);   // deep indigo
    vec3 mid     = vec3(0.10, 0.20, 0.55);   // denim blue
    vec3 hi      = vec3(0.30, 0.75, 0.95);   // cyan foam highlight

    vec3 col = mix(deep, mid, n);
    col = mix(col, hi, smoothstep(0.65, 1.0, n2) * (0.4 + uActivity * 0.4));

    // subtle vertical shading — darker toward bottom of the tank
    col *= 0.6 + 0.5 * (vPos.y + 0.5);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function LiquidSurface({ activity }: { activity: number }) {
  const matRef = useRef<ShaderMaterial>(null);
  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    matRef.current.uniforms.uActivity.value = THREE.MathUtils.lerp(
      matRef.current.uniforms.uActivity.value,
      Math.min(1, activity * 0.15),
      0.05,
    );
  });
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uActivity: { value: 0 } }),
    [],
  );
  return (
    <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.92, 96]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={liquidVertex}
        fragmentShader={liquidFragment}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/* ---------- Mixing tank ---------- */

function Tank() {
  return (
    <group>
      {/* Outer glass shell */}
      <Cylinder args={[1.0, 1.0, 1.8, 64, 1, true]} position={[0, 0, 0]}>
        <meshPhysicalMaterial
          color="#e6f2ff"
          transmission={0.9}
          transparent
          opacity={0.18}
          roughness={0.05}
          metalness={0.1}
          thickness={0.4}
          ior={1.3}
          side={THREE.DoubleSide}
        />
      </Cylinder>
      {/* Bottom cap */}
      <Cylinder args={[1.0, 1.0, 0.05, 64]} position={[0, -0.9, 0]}>
        <meshStandardMaterial
          color="#8ab4d8"
          metalness={0.9}
          roughness={0.25}
        />
      </Cylinder>
      {/* Top flange rim */}
      <Cylinder args={[1.05, 1.05, 0.06, 64]} position={[0, 0.92, 0]}>
        <meshStandardMaterial
          color="#cfe1f2"
          metalness={0.95}
          roughness={0.2}
          emissive="#22d3ee"
          emissiveIntensity={0.15}
        />
      </Cylinder>
      {/* Support legs */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.85, -1.15, Math.sin(a) * 0.85]}>
            <cylinderGeometry args={[0.04, 0.04, 0.55, 12]} />
            <meshStandardMaterial color="#6b7d8f" metalness={0.85} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------- Rotating agitator inside the tank ---------- */

function Agitator() {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.getElapsedTime() * 2.2;
  });
  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* Shaft */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.4, 16]} />
        <meshStandardMaterial color="#c9d6e2" metalness={0.95} roughness={0.15} />
      </mesh>
      {/* Impeller blades */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.28, -0.35, Math.sin(a) * 0.28]}
            rotation={[0, -a, Math.PI / 8]}
          >
            <boxGeometry args={[0.5, 0.02, 0.14]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#22d3ee"
              emissiveIntensity={0.4}
              metalness={0.7}
              roughness={0.25}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------- Dosing pipe + descending droplet for one product ---------- */

function DosingLine({
  index,
  total,
  color,
  glow,
}: {
  index: number;
  total: number;
  color: string;
  glow: string;
}) {
  const dropRef = useRef<Mesh>(null);
  const angle = (index / total) * Math.PI * 2;
  const radius = 1.6;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const phase = index * 0.7;

  // Curved pipe: down from manifold, elbow, into tank top
  const curve = useMemo(() => {
    const start = new THREE.Vector3(x, 2.2, z);
    const elbow1 = new THREE.Vector3(x, 1.6, z);
    const elbow2 = new THREE.Vector3(x * 0.55, 1.2, z * 0.55);
    const end = new THREE.Vector3(x * 0.35, 0.95, z * 0.35);
    return new THREE.CatmullRomCurve3([start, elbow1, elbow2, end]);
  }, [x, z]);

  useFrame((state) => {
    if (!dropRef.current) return;
    const t = (state.clock.getElapsedTime() * 0.35 + phase) % 1;
    // travel along pipe (0..0.85) then fall into tank (0.85..1)
    let pos: THREE.Vector3;
    if (t < 0.85) {
      pos = curve.getPointAt(t / 0.85);
    } else {
      const fall = (t - 0.85) / 0.15;
      const top = curve.getPointAt(1);
      pos = new THREE.Vector3(
        top.x * (1 - fall * 0.6),
        top.y - fall * 0.8,
        top.z * (1 - fall * 0.6),
      );
    }
    dropRef.current.position.copy(pos);
    const s = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
    dropRef.current.scale.setScalar(0.08 * s);
  });

  return (
    <group>
      {/* Pipe */}
      <Tube args={[curve, 64, 0.035, 12, false]}>
        <meshStandardMaterial
          color="#b5c6d6"
          metalness={0.85}
          roughness={0.3}
        />
      </Tube>
      {/* Nozzle */}
      <mesh position={[x * 0.35, 0.95, z * 0.35]}>
        <cylinderGeometry args={[0.05, 0.03, 0.1, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {/* Chemical reservoir at manifold */}
      <mesh position={[x, 2.35, z]}>
        <cylinderGeometry args={[0.13, 0.13, 0.28, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          metalness={0.4}
          roughness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Glowing droplet */}
      <mesh ref={dropRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          metalness={0.2}
          roughness={0.15}
        />
      </mesh>
      {/* Glow halo at nozzle */}
      <mesh position={[x * 0.35, 0.95, z * 0.35]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={glow} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/* ---------- Overhead manifold ring ---------- */

function Manifold() {
  return (
    <group position={[0, 2.5, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.05, 20, 96]} />
        <meshStandardMaterial
          color="#8ea3b8"
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 24]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.6}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

/* ---------- Full assembly, slowly rotating ---------- */

function Rig({ activity, colors }: { activity: number; colors: string[] }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });
  return (
    <group ref={group} position={[0, -0.2, 0]}>
      <Manifold />
      <Tank />
      <LiquidSurface activity={activity} />
      <Agitator />
      {colors.map((c, i) => (
        <DosingLine
          key={i}
          index={i}
          total={colors.length}
          color={c}
          glow={c}
        />
      ))}
      {/* Floor pad */}
      <mesh position={[0, -1.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 2.4, 64]} />
        <meshStandardMaterial
          color="#0b1220"
          metalness={0.4}
          roughness={0.8}
          emissive="#0a1a2a"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

/* ---------- Ambient floating chemical particles ---------- */

function Particles({ colors }: { colors: string[] }) {
  const nodes = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => {
        const a = Math.random() * Math.PI * 2;
        const r = 2.6 + Math.random() * 1.2;
        return {
          pos: [
            Math.cos(a) * r,
            (Math.random() - 0.5) * 2.5,
            Math.sin(a) * r,
          ] as [number, number, number],
          color: colors[i % colors.length],
          size: 0.02 + Math.random() * 0.03,
        };
      }),
    [colors],
  );
  return (
    <>
      {nodes.map((n, i) => (
        <Float key={i} speed={1.2 + (i % 4) * 0.3} floatIntensity={1.5} rotationIntensity={0}>
          <mesh position={n.pos}>
            <sphereGeometry args={[n.size, 8, 8]} />
            <meshBasicMaterial color={n.color} transparent opacity={0.7} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

export function Scene3D({
  activity = 0,
  colors,
}: {
  activity?: number;
  colors: string[];
}) {
  return (
    <Canvas
      camera={{ position: [3.2, 1.8, 4.2], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#00000000"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 6, 4]} intensity={1.1} color="#ffffff" />
      <pointLight position={[3, 3, 3]} intensity={2.2} color="#22d3ee" />
      <pointLight position={[-3, 2, -2]} intensity={1.8} color="#3b82f6" />
      <pointLight position={[0, -1, 3]} intensity={1.2} color="#a78bfa" />
      <Rig activity={activity} colors={colors} />
      <Particles colors={colors} />
    </Canvas>
  );
}
