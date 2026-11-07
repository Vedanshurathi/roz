// Diwali film (9:16) in the same voxel style: diya lighting, village lane, local shop that lights up,
// whole village glowing, fireworks, giant voxel HAPPY DIWALI. Every frame from code.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Chibi, Card, VoxelWord, makeCanvas, skyTex, Sky, clamp, easeOut, easeInOut, back, rnd, V3} from './Film';

type Line = {text: string; start: number; end: number};
export type DiwaliProps = {lines: Line[]; total: number};
const GOLD = '#ffc63c', FLAME = '#ffb22e';

// ------------------------------------------------------------ diya + flame
const Diya: React.FC<{pos: V3; lit: number; t: number; seed?: number; s?: number}> = ({pos, lit, t, seed = 0, s = 1}) => {
  const fl = lit > 0 ? (0.85 + 0.15 * Math.sin(t * 17 + seed * 3) + 0.08 * Math.sin(t * 29 + seed)) * lit : 0;
  return (
    <group position={pos} scale={s}>
      <mesh castShadow position={[0, 0.05, 0]} scale={[1, 0.45, 1]}><sphereGeometry args={[0.16, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#b4532a" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.14, 18]} /><meshStandardMaterial color="#e3a53a" emissive="#ff9a2a" emissiveIntensity={0.4 * lit} /></mesh>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.155, 0.018, 6, 24]} /><meshStandardMaterial color="#e08a3a" /></mesh>
      {fl > 0.01 && (<>
        <mesh position={[0.07, 0.15 + 0.03 * fl, 0]} scale={[fl, fl * (1 + 0.1 * Math.sin(t * 23 + seed)), fl]}><coneGeometry args={[0.045, 0.16, 10]} /><meshBasicMaterial color="#ffd36b" toneMapped={false} /></mesh>
        <mesh position={[0.07, 0.11, 0]} scale={fl}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color="#fff2c0" toneMapped={false} /></mesh>
        <mesh position={[0.07, 0.15, 0]} scale={fl * 2.4}><sphereGeometry args={[0.06, 10, 8]} /><meshBasicMaterial color={FLAME} transparent opacity={0.18} toneMapped={false} depthWrite={false} /></mesh>
      </>)}
    </group>
  );
};

// hanging paper lantern (kandil)
const Kandil: React.FC<{pos: V3; on: number; color?: string; t: number}> = ({pos, on, color = '#ff5a2a', t}) => (
  <group position={[pos[0], pos[1] + Math.sin(t * 1.5 + pos[0]) * 0.03, pos[2]]} rotation={[0, t * 0.4 + pos[0], 0]}>
    <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.005, 0.005, 0.6, 4]} /><meshBasicMaterial color="#222" /></mesh>
    <mesh position={[0, 0.12, 0]}><coneGeometry args={[0.2, 0.22, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15 + 1.4 * on} /></mesh>
    <mesh position={[0, -0.1, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.2, 0.22, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15 + 1.4 * on} /></mesh>
    {[0, 1, 2, 3, 4].map((k) => <mesh key={k} position={[Math.cos(k * 1.26) * 0.08, -0.32, Math.sin(k * 1.26) * 0.08]}><boxGeometry args={[0.01, 0.2, 0.01]} /><meshBasicMaterial color={GOLD} /></mesh>)}
  </group>
);

// string of fairy bulbs between two points (catenary), lighting up left→right
const Lights: React.FC<{a: V3; b: V3; n: number; on: number; t: number; sag?: number}> = ({a, b, n, on, t, sag = 0.25}) => (
  <group>
    {Array.from({length: n}).map((_, k) => {
      const f = k / (n - 1); const lit = clamp(on * (n + 4) - k);
      const p: V3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * sag, a[2] + (b[2] - a[2]) * f];
      const col = ['#ffd166', '#ff6b6b', '#ffffff', '#ffb02e'][k % 4];
      return <mesh key={k} position={p}><sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color={lit > 0.5 ? col : '#3a2a1a'} toneMapped={false} transparent opacity={lit > 0.5 ? 0.75 + 0.25 * Math.sin(t * 6 + k) : 1} /></mesh>;
    })}
  </group>
);

// ------------------------------------------------------------ fireworks (instanced)
type Burst = {tb: number; c: V3; col: string; r: number};
const Fireworks: React.FC<{t: number; bursts: Burst[]; n?: number}> = ({t, bursts, n = 120}) => {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const count = bursts.length * (n + 1);
  const dirs = useMemo(() => Array.from({length: n}, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(0.75 + rnd(i) * 0.35);
  }), [n]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let idx = 0;
    bursts.forEach((b, bi) => {
      const lt = t - b.tb;
      // rocket
      const rise = clamp(lt / 0.7);
      if (lt >= 0 && lt < 0.7) { p.set(b.c[0], -1 + (b.c[1] + 1) * easeOut(rise), b.c[2]); sc.setScalar(0.06); }
      else { p.set(0, -100, 0); sc.setScalar(0.0001); }
      m.compose(p, q, sc); ref.current.setMatrixAt(idx, m); ref.current.setColorAt(idx, c.set('#fff2c0')); idx++;
      // sparks
      const e = lt - 0.7;
      dirs.forEach((d, i) => {
        if (e > 0 && e < 2.4) {
          const k = easeOut(e / 1.1) * b.r;
          p.set(b.c[0] + d.x * k, b.c[1] + d.y * k - 0.35 * e * e, b.c[2] + d.z * k);
          const life = 1 - clamp((e - 1.0) / 1.4);
          sc.setScalar(0.085 * life * (0.7 + 0.6 * rnd(i + bi * 31)) * (1 + 0.3 * Math.sin(t * 30 + i)));
        } else { p.set(0, -100, 0); sc.setScalar(0.0001); }
        m.compose(p, q, sc); ref.current.setMatrixAt(idx, m);
        ref.current.setColorAt(idx, c.set(i % 7 === 0 ? '#ffffff' : b.col)); idx++;
      });
    });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined as any, undefined as any, count]}><sphereGeometry args={[1, 6, 4]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
};

// stars on the sky dome
const Stars: React.FC<{t: number}> = ({t}) => {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const N = 260;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const th = rnd(i) * Math.PI * 2, ph = 0.08 + rnd(i + 99) * 1.3;
      p.set(Math.cos(th) * Math.cos(ph) * 32, Math.sin(ph) * 32, Math.sin(th) * Math.cos(ph) * 32);
      sc.setScalar(0.05 + 0.07 * rnd(i + 7) * (0.6 + 0.4 * Math.sin(t * 3 + i)));
      m.compose(p, q, sc); ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined as any, undefined as any, N]}><sphereGeometry args={[1, 4, 3]} /><meshBasicMaterial color="#ffffff" toneMapped={false} fog={false} /></instancedMesh>;
};

// rangoli: concentric rings of coloured voxels that assemble ring by ring
const Rangoli: React.FC<{pos: V3; t: number; t0: number; s?: number}> = ({pos, t, t0, s = 1}) => {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const rings = [[0.0, 1, '#ffd166'], [0.12, 8, '#ff3448'], [0.22, 12, '#ff9f1c'], [0.33, 16, '#e83e8c'], [0.44, 20, '#2ec4b6'], [0.55, 24, '#ffd166'], [0.66, 28, '#ff3448'], [0.76, 32, '#7c4dff']] as [number, number, string][];
  const cells = useMemo(() => { const out: {p: V3; col: string; ring: number}[] = [];
    rings.forEach(([r, n, col], ri) => { for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + ri * 0.2; out.push({p: [Math.cos(a) * r, 0, Math.sin(a) * r], col, ring: ri}); } });
    return out; }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    cells.forEach((cl, i) => {
      const a = back((t - t0 - cl.ring * 0.08) / 0.35);
      p.set(cl.p[0], 0.02 + (1 - clamp(a)) * 0.3, cl.p[2]); sc.set(0.075 * a, 0.03, 0.075 * a);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(cl.p[2], cl.p[0]));
      m.compose(p, q, sc.x > 0 ? sc : sc.setScalar(0.0001)); ref.current.setMatrixAt(i, m); ref.current.setColorAt(i, c.set(cl.col));
    });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return <group position={pos} scale={s}><instancedMesh ref={ref} args={[undefined as any, undefined as any, cells.length]} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.6} /></instancedMesh></group>;
};

// village house with a flat roof terrace and lit windows
const House: React.FC<{pos: V3; w?: number; h?: number; col: string; lit: number; rotY?: number}> = ({pos, w = 1.6, h = 1.6, col, lit, rotY = 0}) => (
  <group position={pos} rotation={[0, rotY, 0]}>
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[w, h, 1.4]} /><meshStandardMaterial color={col} roughness={0.9} /></mesh>
    <mesh position={[0, h + 0.08, 0]} castShadow><boxGeometry args={[w + 0.08, 0.16, 1.48]} /><meshStandardMaterial color="#efe2c8" /></mesh>
    <mesh position={[0, 0.42, 0.705]}><planeGeometry args={[0.36, 0.84]} /><meshStandardMaterial color="#5a3420" /></mesh>
    {[-1, 1].map((sx) => <mesh key={sx} position={[sx * w * 0.28, h * 0.62, 0.705]}><planeGeometry args={[0.3, 0.3]} />
      <meshStandardMaterial color="#2a2030" emissive="#ffb347" emissiveIntensity={lit * 1.6} /></mesh>)}
  </group>
);

// shop stall
const Shop: React.FC<{pos: V3; t: number; on: number; items: number[]}> = ({pos, t, on, items}) => {
  const awning = useMemo(() => makeCanvas(256, 64, (x) => { for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#ffffff' : '#e8323c'; x.fillRect(k * 32, 0, 32, 64); } }), []);
  const sign = useMemo(() => makeCanvas(512, 128, (x) => { x.fillStyle = '#1c3d8f'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#ffd166';
    x.font = '900 64px Poppins, sans-serif'; x.textAlign = 'center'; x.fillText('SHARMA STORE', 256, 86); }), []);
  return (
    <group position={pos}>
      <mesh position={[0, 1.3, -0.6]} castShadow receiveShadow><boxGeometry args={[2.6, 2.6, 0.2]} /><meshStandardMaterial color="#d9a066" roughness={0.9} /></mesh>
      {[-1.25, 1.25].map((x) => <mesh key={x} position={[x, 1.3, 0]} castShadow><boxGeometry args={[0.12, 2.6, 1.3]} /><meshStandardMaterial color="#c58a52" /></mesh>)}
      <mesh position={[0, 2.68, 0.15]} castShadow><boxGeometry args={[2.8, 0.14, 1.8]} /><meshStandardMaterial color="#8b5a3a" /></mesh>
      <mesh position={[0, 2.45, 1.0]} rotation={[0.5, 0, 0]}><planeGeometry args={[2.8, 0.7]} /><meshStandardMaterial map={awning} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 2.95, 0.3]}><planeGeometry args={[2.0, 0.5]} /><meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.25 + 0.5 * on} /></mesh>
      {/* shelves with boxes */}
      {[0.9, 1.55, 2.1].map((y, r) => (
        <group key={r}>
          <mesh position={[0, y, -0.4]}><boxGeometry args={[2.3, 0.04, 0.35]} /><meshStandardMaterial color="#7a4a2a" /></mesh>
          {Array.from({length: 7}).map((_, k) => <mesh key={k} position={[-0.95 + k * 0.32, y + 0.13, -0.42]} castShadow><boxGeometry args={[0.22, 0.22 + rnd(k + r * 9) * 0.1, 0.22]} />
            <meshStandardMaterial color={['#ff3448', '#ffd166', '#2ec4b6', '#7c4dff', '#ff9f1c', '#3ddc84', '#ffffff'][(k + r) % 7]} /></mesh>)}
        </group>))}
      {/* counter */}
      <mesh position={[0, 0.5, 0.45]} castShadow receiveShadow><boxGeometry args={[2.4, 1.0, 0.6]} /><meshStandardMaterial color="#a8683a" roughness={0.8} /></mesh>
      <mesh position={[0, 1.02, 0.45]}><boxGeometry args={[2.5, 0.05, 0.7]} /><meshStandardMaterial color="#e9d8b8" /></mesh>
      {/* items that land on the counter: mithai box, diyas, gift */}
      <Item kind="mithai" t={t} t0={items[0]} to={[-0.75, 1.05, 0.45]} />
      <Item kind="diyas" t={t} t0={items[1]} to={[0.0, 1.05, 0.5]} />
      <Item kind="gift" t={t} t0={items[2]} to={[0.75, 1.05, 0.45]} />
      {/* lanterns + lights */}
      <Kandil pos={[-1.05, 1.95, 1.25]} on={on} t={t} />
      <Kandil pos={[1.05, 1.95, 1.25]} on={on} color="#ffcc33" t={t} />
      <Lights a={[-1.4, 2.6, 1.3]} b={[1.4, 2.6, 1.3]} n={16} on={on} t={t} />
      <pointLight position={[0, 1.9, 0.6]} intensity={1.6 + 5 * on} distance={4.5} decay={1.5} color="#ffb35a" />
      {[-1.0, -0.6, 0.6, 1.0].map((x, k) => <Diya key={k} pos={[x, 0.0, 1.0]} lit={clamp(on * 5 - k)} t={t} seed={k + 3} s={0.9} />)}
    </group>
  );
};

const Item: React.FC<{kind: string; t: number; t0: number; to: V3}> = ({kind, t, t0, to}) => {
  const lt = t - t0; if (lt < 0) return null;
  const k = easeOut(lt / 0.55); const h = Math.sin(clamp(lt / 0.55) * Math.PI) * 0.8;
  const p: V3 = [to[0] * (0.2 + 0.8 * k) + (1 - k) * 1.5, to[1] + h + (1 - k) * 0.5, to[2] + (1 - k) * 2.2];
  const sp = (1 - k) * 6;
  return (
    <group position={p} rotation={[0, sp, 0]}>
      {kind === 'mithai' && (<>
        <mesh position={[0, 0.07, 0]} castShadow><boxGeometry args={[0.5, 0.14, 0.36]} /><meshStandardMaterial color="#ff4f9a" /></mesh>
        {[[-0.14, -0.08], [0, -0.08], [0.14, -0.08], [-0.07, 0.06], [0.07, 0.06]].map(([x, z], i) => <mesh key={i} position={[x, 0.2, z]} castShadow><sphereGeometry args={[0.07, 12, 10]} /><meshStandardMaterial color="#ffa62b" roughness={0.9} /></mesh>)}
        <mesh position={[0, 0.3, 0]} castShadow><sphereGeometry args={[0.07, 12, 10]} /><meshStandardMaterial color="#ffa62b" roughness={0.9} /></mesh>
      </>)}
      {kind === 'diyas' && [-0.14, 0.14].map((x, i) => <Diya key={i} pos={[x, 0, 0]} lit={clamp(lt - 0.4)} t={t} seed={i + 9} s={1.1} />)}
      {kind === 'gift' && (<>
        <mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[0.32, 0.32, 0.32]} /><meshStandardMaterial color="#7c4dff" /></mesh>
        <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.34, 0.34, 0.06]} /><meshStandardMaterial color={GOLD} /></mesh>
        <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.06, 0.34, 0.34]} /><meshStandardMaterial color={GOLD} /></mesh>
        <mesh position={[0, 0.36, 0]} rotation={[0, 0.7, 0]}><torusGeometry args={[0.06, 0.02, 6, 12]} /><meshStandardMaterial color={GOLD} /></mesh>
      </>)}
    </group>
  );
};

// ------------------------------------------------------------ the village set (one world, many camera angles)
const NIGHT = () => skyTex([[0, '#05051a'], [0.45, '#141a4a'], [0.62, '#3a2a5e'], [0.7, '#7a3a4a'], [1, '#2a1420']]);
const Village: React.FC<{t: number; shot: number; st: number; starts: number[]}> = ({t, shot, st, starts}) => {
  const sky = useMemo(NIGHT, []);
  const ground = useMemo(() => { const x = makeCanvas(256, 256, (c) => { c.fillStyle = '#6b4a34'; c.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1500; k++) { c.fillStyle = rnd(k) > 0.5 ? '#7a563c' : '#5a3c2a'; c.fillRect(rnd(k + 1) * 256, rnd(k + 2) * 256, 3, 3); } });
    x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(12, 12); return x; }, []);
  const S = (k: number) => starts[k];
  const shopOn = shot >= 4 ? easeOut((t - S(4) - 0.2) / 1.2) : 0;
  const glow = shot >= 5 ? clamp((t - S(5)) / 1.6) : 0;                 // whole village lights up as a wave
  const homeLit = shot >= 0 ? clamp((t - 1.2) / 0.5) : 0;
  const houses: [V3, string, number][] = [
    [[-3.6, 0, -2.2], '#f4a6c1', 0.1], [[-1.8, 0, -2.6], '#ffd27a', 0.2], [[2.2, 0, -2.5], '#9fd3ff', 0.35], [[4.0, 0, -2.0], '#b8f2a8', 0.45],
    [[-5.2, 0, -4.5], '#ffc09e', 0.55], [[-2.8, 0, -5.5], '#d6b8ff', 0.6], [[0.6, 0, -5.8], '#ffe39e', 0.7], [[3.6, 0, -5.0], '#ff9fb5', 0.8], [[6.2, 0, -4.4], '#a6f0e0', 0.9],
    [[-7, 0, -8], '#f7c59f', 0.95], [[-3.5, 0, -9], '#c3d8ff', 1], [[0.5, 0, -9.5], '#ffd6e7', 1], [[4.5, 0, -9], '#e2ffb8', 1], [[8, 0, -8], '#ffe0a3', 1],
  ];
  const fire: {tb: number; c: V3; col: string; r: number}[] = shot >= 5 ? [
    {tb: S(5) + 0.2, c: [-2.5, 6.5, -8], col: '#ff4f9a', r: 2.2}, {tb: S(5) + 0.7, c: [2.8, 7.2, -9], col: '#ffd166', r: 2.6},
    {tb: S(5) + 1.3, c: [0.2, 8.0, -10], col: '#4dc3ff', r: 2.8}, {tb: S(6) - 0.2, c: [-3.2, 7.6, -9], col: '#3ddc84', r: 2.4},
    {tb: S(6) + 0.5, c: [3.4, 8.2, -9], col: '#ff3448', r: 2.6}, {tb: S(6) + 1.2, c: [0, 9.0, -11], col: '#ffd166', r: 3.0},
    {tb: S(6) + 2.0, c: [-2.0, 8.4, -10], col: '#b57bff', r: 2.5}, {tb: S(7) - 0.3, c: [2.4, 7.8, -9], col: '#ffffff', r: 2.4},
    {tb: S(7) + 0.5, c: [-1.2, 8.6, -10], col: '#ff9f1c', r: 2.7},
  ] : [];
  return (<>
    <Sky tex={sky} />
    <Stars t={t} />
    <mesh position={[9, 11, -24]}><sphereGeometry args={[1.1, 24, 16]} /><meshBasicMaterial color="#fff4d6" toneMapped={false} fog={false} /></mesh>
    <fog attach="fog" args={['#120c24', 9, 30]} />
    <hemisphereLight args={['#4a5aa8', '#2a1408', 0.45 + 0.25 * glow]} />
    <directionalLight position={[-6, 8, 4]} intensity={0.35} color="#8fa2ff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[80, 80]} /><meshLambertMaterial map={ground} /></mesh>
    {/* founder's home courtyard (front-left) */}
    <House pos={[-1.6, 0, 0.2]} w={2.0} h={1.8} col="#f6d0a2" lit={homeLit} />
    <pointLight position={[-0.3, 0.6, 1.6]} intensity={4 * homeLit} distance={4} decay={1.5} color="#ffaa44" />
    {[-2.4, -1.9, -1.4, -0.9].map((x, k) => <Diya key={k} pos={[x, 1.88, 0.85]} lit={clamp((t - 1.3 - k * 0.15) / 0.3)} t={t} seed={k} s={0.8} />)}
    <Rangoli pos={[0.1, 0, 1.55]} t={t} t0={0.3} s={0.95} />
    <Diya pos={[0.1, 0, 1.55]} lit={clamp((t - 1.1) / 0.35)} t={t} seed={1} s={1.4} />
    {/* neighbours */}
    {houses.map(([p, c, d], k) => <House key={k} pos={p} col={c} lit={clamp((glow - d * 0.75) * 4)} h={1.5 + rnd(k) * 0.6} w={1.5 + rnd(k + 3) * 0.4} />)}
    {/* lane string lights across the street light up with the village */}
    <Lights a={[-4, 2.6, -1.2]} b={[4.5, 2.6, -1.3]} n={24} on={glow} t={t} sag={0.35} />
    <Lights a={[-6, 2.4, -3.6]} b={[6.5, 2.4, -3.8]} n={28} on={clamp(glow - 0.25)} t={t} sag={0.3} />
    {/* the small local shop, down the lane on the right */}
    <Shop pos={[3.4, 0, 1.2]} t={t} on={shopOn} items={[S(3) + 0.9, S(3) + 1.6, S(3) + 2.3]} />
    <Chibi pos={[3.4, 0, 1.12]} rotY={0} t={t} variant="uncle" scale={0.8} wave={shot >= 4 ? clamp((t - S(4) - 0.8) / 0.3) : 0} talk={shot === 2} />
    {/* founder */}
    <Chibi pos={shot <= 1 ? [0.75, 0, 1.75] : shot === 7 ? [1.3, 0, 1.2] : shot >= 5 ? [0.85, 0, 2.6] : [2.2, 0, 2.6]} rotY={shot <= 1 ? -1.2 : shot >= 5 ? -0.25 : Math.PI + 0.35}
      t={t} variant="founder" scale={0.85} armX={shot === 0 ? 1.1 * clamp(st / 0.5) * (1 - clamp((st - 1.5) / 0.4)) : 0}
      wave={shot >= 6 ? clamp((t - S(6) - 0.3) / 0.3) : 0} />
    {glow > 0 && <pointLight position={[0, 3, -4]} intensity={8 * glow} distance={14} decay={1.4} color="#ffae52" />}
    <Fireworks t={t} bursts={fire} />
    {shot === 6 && <VoxelWord word="HAPPY" s={0.12} color={GOLD} pos={[0.1, 3.85, 0.6]} t={t} t0={S(6) + 0.05} stagger={0.09} emissive={0.9} />}
    {shot === 6 && <VoxelWord word="DIWALI" s={0.12} color="#ff7a2a" pos={[0.1, 2.85, 0.6]} t={t} t0={S(6) + 0.45} stagger={0.09} emissive={0.9} />}
    {shot === 7 && <Card pos={[-0.12, 1.3, 2.4]} t={t} t0={S(7) + 0.3} who="you" text="🪔🪔🪔" color="#ff9f1c" w={1.05} typed />}
    {shot >= 5 && <pointLight position={[0.9, 1.7, 4.4]} intensity={3.5} distance={4} decay={1.4} color="#ffcf9a" />}
  </>);
};

// ------------------------------------------------------------ camera per shot (portrait framing)
type Cam = {p: V3; t: V3; d?: V3; fov?: number};
const CAMS: Cam[] = [
  {p: [1.35, 1.0, 3.8], t: [0.4, 0.55, 1.6], d: [-0.45, -0.15, -0.6], fov: 50},     // 0 close: diya lights on the rangoli
  {p: [0.6, 1.6, 6.0], t: [-0.8, 1.2, 0], d: [1.2, 0.5, 0.4], fov: 55},            // 1 pull back: home glowing, lane dark
  {p: [4.0, 1.7, 6.6], t: [3.4, 1.55, 1.0], d: [-0.5, 0, -1.3], fov: 52},           // 2 the small dark shop + uncle waiting
  {p: [3.5, 2.0, 4.7], t: [3.4, 1.2, 1.6], d: [0, -0.15, -0.6], fov: 50},     // 3 items land on the counter
  {p: [3.4, 1.5, 7.4], t: [3.4, 1.75, 1.0], d: [0, 0.2, -0.9], fov: 55},            // 4 shop lights up
  {p: [0.5, 3.0, 9.0], t: [0.5, 3.4, -4], d: [0, 2.2, 1.0], fov: 58},              // 5 crane up: village glows + fireworks
  {p: [0.4, 2.4, 9.2], t: [0.2, 3.2, 0], d: [0, 0.1, -1.0], fov: 55},              // 6 HAPPY DIWALI
  {p: [0.35, 1.35, 6.2], t: [0.15, 1.0, 1.8], d: [-0.2, 0, -0.7], fov: 55},         // 7 comment a diya
];
const Rig: React.FC<{shot: number; st: number; dur: number; t: number}> = ({shot, st, dur, t}) => {
  const {camera} = useThree();
  const c = CAMS[shot], d = c.d || [0, 0, 0];
  const k = easeInOut(clamp(st / Math.max(0.5, dur))) * 0.85 + clamp(st / Math.max(0.5, dur)) * 0.15;
  const whip = 1 - easeOut(st / 0.4);
  camera.position.set(c.p[0] + d[0] * k + whip * 0.4, c.p[1] + d[1] * k + whip * 0.12, c.p[2] + d[2] * k + whip * 0.5);
  camera.position.x += Math.sin(t * 0.9) * 0.012; camera.position.y += Math.sin(t * 1.3 + 1) * 0.008;
  camera.lookAt(c.t[0], c.t[1], c.t[2]);
  (camera as THREE.PerspectiveCamera).fov = c.fov || 55; camera.updateProjectionMatrix();
  return null;
};

export const Diwali: React.FC<DiwaliProps> = ({lines, total}) => {
  const frame = useCurrentFrame(); const {fps, width, height} = useVideoConfig();
  const UI = width / 1080;
  const t = frame / fps;
  const starts = [0, ...lines.slice(1).map((l) => l.start - 0.25)];
  let shot = 0; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) shot = k;
  const st = t - starts[shot]; const dur = (shot + 1 < starts.length ? starts[shot + 1] : total) - starts[shot];
  const caption = lines.find((l) => t >= l.start - 0.05 && t < l.end + 0.35);
  const KEY = new Set(['DIWALI,', 'DIYA', 'DUKAAN', 'LOCAL', 'ROSHAN', 'BHARAT', 'JAGMAGATA', 'DIWALI', 'VEDANSHU', 'ROZBAZAAR', 'DIYA.']);
  const flash = shot > 0 ? 1 - clamp(st / 0.18) : 0;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <style>{`@font-face{font-family:Poppins;font-weight:700;src:url(${staticFile('Poppins-ExtraBold.ttf')})}
               @font-face{font-family:Poppins;font-weight:800;src:url(${staticFile('Poppins-ExtraBold.ttf')})}
               @font-face{font-family:Poppins;font-weight:900;src:url(${staticFile('Poppins-Black.ttf')})}`}</style>
      <ThreeCanvas width={width} height={height} shadows dpr={1}
        gl={{toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.25, antialias: false}} camera={{fov: 55, near: 0.05, far: 120}}>
        <Rig shot={shot} st={st} dur={dur} t={t} />
        <Village t={t} shot={shot} st={st} starts={starts} />
      </ThreeCanvas>
      {caption && (
        <div style={{position: 'absolute', top: 210 * UI, left: 70 * UI, right: 70 * UI, textAlign: 'center', fontFamily: 'Poppins', fontWeight: 800,
          fontSize: 66 * UI, color: '#fff', textShadow: `0 ${4 * UI}px ${22 * UI}px rgba(0,0,0,0.85)`, lineHeight: 1.18}}>
          {caption.text.split(' ').map((w, k, arr) => {
            const ws = caption.start + ((caption.end - caption.start) * k) / arr.length;
            const a = clamp((t - ws) / 0.12); const key = KEY.has(w.toUpperCase());
            return <span key={k} style={{opacity: a, display: 'inline-block', transform: `translateY(${(1 - easeOut(a)) * 14 * UI}px)`,
              color: key ? GOLD : '#fff', marginRight: 16 * UI}}>{w}</span>;
          })}
        </div>
      )}
      {shot === 7 && (
        <div style={{position: 'absolute', bottom: 300 * UI, width: '100%', textAlign: 'center', fontFamily: 'Poppins', fontWeight: 900, fontSize: 76 * UI, color: '#fff',
          textShadow: `0 ${4 * UI}px ${24 * UI}px rgba(0,0,0,0.8)`, transform: `scale(${back((st - 0.6) / 0.4)})`}}>
          Comment <span style={{color: GOLD}}>🪔</span></div>
      )}
      <div style={{position: 'absolute', bottom: 200 * UI, width: '100%', textAlign: 'center', fontFamily: 'Poppins', fontWeight: 800, fontSize: 34 * UI,
        color: 'rgba(255,255,255,0.8)'}}>@vedanshurathi</div>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)'}} />
      <AbsoluteFill style={{background: '#fff', opacity: flash * 0.3}} />
      <AbsoluteFill style={{background: '#000', opacity: 1 - clamp(t / 0.5)}} />
    </AbsoluteFill>
  );
};
