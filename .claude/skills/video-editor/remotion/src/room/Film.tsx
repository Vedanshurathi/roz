// "Ye reel kisi editing app mein nahi bani" — multi-world voxel film in the style of Vedanshu's
// reference (new world every beat, chibi voxel character, giant voxel letters, burst sphere, gallery).
// Every frame from code. Shots are timed by the voiceover timeline (props).
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';

type Line = {text: string; start: number; end: number};
export type FilmProps = {lines: Line[]; total: number};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const back = (x: number) => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
export const bounce = (x: number) => { x = clamp(x); const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
export const rnd = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
export type V3 = [number, number, number];

// ------------------------------------------------------------ canvas helpers
export function makeCanvas(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, nearest = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; } else t.anisotropy = 8;
  return t;
}
export function rr(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
export const skyTex = (stops: [number, string][]) => makeCanvas(16, 512, (x) => {
  const g = x.createLinearGradient(0, 0, 0, 512); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 16, 512);
});

export const Sky: React.FC<{tex: THREE.Texture}> = ({tex}) => (
  <mesh><sphereGeometry args={[40, 32, 16]} /><meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} fog={false} /></mesh>
);

// ------------------------------------------------------------ voxel pixel font
export const GLYPH: Record<string, string[]> = {
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'], Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
};

export const InstancedVoxels: React.FC<{cells: V3[]; size: number; color: string; colors?: string[]; emissive?: number}> = ({cells, size, color, colors, emissive = 0}) => {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(); const c = new THREE.Color();
    cells.forEach((p, i) => {
      m.makeTranslation(p[0], p[1], p[2]); ref.current.setMatrixAt(i, m);
      if (colors) { ref.current.setColorAt(i, c.set(colors[i % colors.length])); }
    });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [cells, colors]);
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, cells.length]} castShadow receiveShadow>
      <boxGeometry args={[size * 0.96, size * 0.96, size * 0.96]} />
      <meshStandardMaterial color={colors ? '#ffffff' : color} roughness={0.55} emissive={color} emissiveIntensity={emissive} />
    </instancedMesh>
  );
};

// one letter as voxels, origin at bottom-left
function letterCells(ch: string, s: number, depth = 2): V3[] {
  const g = GLYPH[ch]; if (!g) return [];
  const out: V3[] = [];
  g.forEach((row, r) => row.split('').forEach((v, c) => { if (v === '1') for (let z = 0; z < depth; z++) out.push([c * s, (6 - r) * s, -z * s]); }));
  return out;
}

export const VoxelWord: React.FC<{word: string; s: number; color: string; pos: V3; t: number; t0: number; stagger?: number; emissive?: number; rotY?: number; explode?: number}> =
  ({word, s, color, pos, t, t0, stagger = 0.12, emissive = 0.08, rotY = 0, explode = 0}) => {
  const letters = useMemo(() => word.split('').map((ch) => letterCells(ch, s)), [word, s]);
  const w = word.length * 6 * s;
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {letters.map((cells, k) => {
        const lt = (t - t0 - k * stagger) / 0.7;
        if (lt < 0) return null;
        const y = (1 - bounce(lt)) * 6;              // drop from the sky and bounce
        const tilt = (1 - easeOut(lt)) * (k % 2 ? 0.6 : -0.6);
        const ex = explode;
        return (
          <group key={k} position={[k * 6 * s - w / 2 + (ex * (k - word.length / 2) * 1.2), y + ex * (1 + k % 2), ex * 2]}
            rotation={[ex * (k + 1) * 0.8, ex * 1.5 + tilt * 0.2, tilt + ex * (k % 2 ? 1.2 : -1.2)]}>
            <InstancedVoxels cells={cells} size={s} color={color} emissive={emissive} />
          </group>
        );
      })}
    </group>
  );
};

// ------------------------------------------------------------ chibi voxel character
function faceTex(hairStyle: 'beanie' | 'founder' | 'uncle') {
  return makeCanvas(16, 16, (x) => {
    x.fillStyle = '#f2c9a0'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = hairStyle === 'founder' ? '#1a1210' : hairStyle === 'uncle' ? '#d8d8d8' : '#3b2418'; x.fillRect(0, 0, 16, 4); x.fillRect(0, 4, 2, 3); x.fillRect(14, 4, 2, 3);
    if (hairStyle === 'founder') { x.fillRect(3, 4, 4, 1); x.fillRect(9, 4, 3, 1); }
    x.fillStyle = '#141018'; x.fillRect(4, 7, 2, 3); x.fillRect(10, 7, 2, 3);
    x.fillStyle = '#ffffff'; x.fillRect(4, 7, 1, 1); x.fillRect(10, 7, 1, 1);
    x.fillStyle = '#e8a0a0'; x.fillRect(2, 10, 2, 1); x.fillRect(12, 10, 2, 1);
    x.fillStyle = '#5a2a20'; x.fillRect(7, 12, 2, 1); x.fillRect(6, 11, 1, 1); x.fillRect(9, 11, 1, 1);
    if (hairStyle === 'founder') { x.fillStyle = '#2a1c16'; x.fillRect(5, 13, 6, 2); x.fillRect(6, 11, 1, 1); }
    if (hairStyle === 'uncle') { x.fillStyle = '#e6e6e6'; x.fillRect(4, 11, 3, 1); x.fillRect(9, 11, 3, 1); x.fillRect(6, 10, 4, 1); }
  }, true);
}

export const Chibi: React.FC<{pos?: V3; rotY?: number; t: number; variant?: 'beanie' | 'founder' | 'uncle'; wave?: number; talk?: boolean; scale?: number; step?: number; armX?: number}> =
  ({pos = [0, 0, 0], rotY = 0, t, variant = 'beanie', wave = 0, talk = false, scale = 1, step = 0, armX = 0}) => {
  const face = useMemo(() => faceTex(variant), [variant]);
  const skin = '#f2c9a0', shirt = variant === 'founder' ? '#d3202f' : variant === 'uncle' ? '#e8862a' : '#1aa5a5', pants = variant === 'uncle' ? '#f1ece0' : '#2a3c78', hat = '#d82a2a', hair = variant === 'founder' ? '#1a1210' : variant === 'uncle' ? '#d8d8d8' : '#3b2418';
  const mats = useMemo(() => {
    const s = new THREE.MeshStandardMaterial({color: skin, roughness: 0.7});
    const f = new THREE.MeshStandardMaterial({map: face, roughness: 0.7});
    return [s, s, s, s, f, s];
  }, [face]);
  const bob = Math.sin(t * 6) * 0.02 + (talk ? Math.abs(Math.sin(t * 9)) * 0.015 : 0);
  const legSwing = Math.sin(step * Math.PI * 2) * 0.5;
  const armR = wave > 0 ? -2.6 + Math.sin(t * 10) * 0.35 * wave : -0.15;
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={scale}>
      {/* legs */}
      <mesh position={[-0.13, 0.28, 0]} rotation={[legSwing, 0, 0]} castShadow><boxGeometry args={[0.2, 0.5, 0.22]} /><meshStandardMaterial color={pants} /></mesh>
      <mesh position={[0.13, 0.28, 0]} rotation={[-legSwing, 0, 0]} castShadow><boxGeometry args={[0.2, 0.5, 0.22]} /><meshStandardMaterial color={pants} /></mesh>
      <mesh position={[-0.13, 0.04, 0.04]} castShadow><boxGeometry args={[0.22, 0.09, 0.3]} /><meshStandardMaterial color="#f4f4f4" /></mesh>
      <mesh position={[0.13, 0.04, 0.04]} castShadow><boxGeometry args={[0.22, 0.09, 0.3]} /><meshStandardMaterial color="#f4f4f4" /></mesh>
      <group position={[0, bob, 0]}>
        {/* body */}
        <mesh position={[0, 0.78, 0]} castShadow><boxGeometry args={[0.56, 0.56, 0.32]} /><meshStandardMaterial color={shirt} roughness={0.85} /></mesh>
        <mesh position={[-0.37, 0.8, 0]} rotation={[0, 0, 0.12]} castShadow><boxGeometry args={[0.18, 0.5, 0.2]} /><meshStandardMaterial color={shirt} /></mesh>
        <group position={[0.36, 1.02, 0]} rotation={[-armX, 0, armX ? 0 : armR]}>
          <mesh position={[0, -0.22, 0]} castShadow><boxGeometry args={[0.18, 0.5, 0.2]} /><meshStandardMaterial color={shirt} /></mesh>
          <mesh position={[0, -0.5, 0]} castShadow><boxGeometry args={[0.16, 0.12, 0.16]} /><meshStandardMaterial color={skin} /></mesh>
        </group>
        {/* big head with pixel face on +z */}
        <mesh position={[0, 1.42, 0]} material={mats} castShadow><boxGeometry args={[0.9, 0.82, 0.82]} /></mesh>
        {variant === 'beanie' ? (<>
          <mesh position={[0, 1.9, -0.02]} castShadow><boxGeometry args={[0.96, 0.24, 0.9]} /><meshStandardMaterial color={hat} roughness={0.95} /></mesh>
          <mesh position={[0, 1.78, 0.02]} castShadow><boxGeometry args={[0.98, 0.1, 0.9]} /><meshStandardMaterial color="#b81e22" roughness={0.95} /></mesh>
          <mesh position={[0, 2.05, -0.04]} castShadow><boxGeometry args={[0.8, 0.12, 0.74]} /><meshStandardMaterial color={hat} roughness={0.95} /></mesh>
        </>) : variant === 'uncle' ? (<>
          <mesh position={[0, 1.9, -0.02]} castShadow><boxGeometry args={[0.92, 0.2, 0.86]} /><meshStandardMaterial color="#fafafa" roughness={0.95} /></mesh>
          <mesh position={[0, 2.02, -0.02]} castShadow><boxGeometry args={[0.3, 0.08, 0.86]} /><meshStandardMaterial color="#f0f0f0" /></mesh>
        </>) : (<>
          <mesh position={[0, 1.88, -0.03]} castShadow><boxGeometry args={[0.94, 0.16, 0.88]} /><meshStandardMaterial color={hair} /></mesh>
          <mesh position={[0, 1.5, -0.42]} castShadow><boxGeometry args={[0.94, 0.6, 0.06]} /><meshStandardMaterial color={hair} /></mesh>
        </>)}
      </group>
    </group>
  );
};

// ------------------------------------------------------------ comment card (social UI)
export const Card: React.FC<{pos: V3; t: number; t0: number; who: string; text: string; color: string; w?: number; rot?: V3; strike?: boolean; typed?: boolean}> =
  ({pos, t, t0, who, text, color, w = 1.6, rot = [0, 0, 0], strike = false, typed = false}) => {
  const lt = t - t0;
  const n = typed ? Math.floor(clamp(lt / 1.0) * text.length) : text.length;
  const tex = useMemo(() => new THREE.CanvasTexture(document.createElement('canvas')), []);
  const c = tex.image as HTMLCanvasElement; c.width = 640; c.height = 220; const x = c.getContext('2d')!;
  x.clearRect(0, 0, 640, 220);
  x.fillStyle = 'rgba(0,0,0,0.25)'; rr(x, 14, 18, 612, 170, 44); x.fill();
  x.fillStyle = '#ffffff'; rr(x, 8, 8, 612, 170, 44); x.fill();
  x.beginPath(); x.moveTo(90, 176); x.lineTo(60, 216); x.lineTo(140, 176); x.fill();
  x.fillStyle = color; x.beginPath(); x.arc(78, 92, 44, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = '800 44px Poppins, sans-serif'; x.textAlign = 'center'; x.fillText(who[0].toUpperCase(), 78, 108);
  x.textAlign = 'left'; x.fillStyle = '#8a8798'; x.font = '700 30px Poppins, sans-serif'; x.fillText('@' + who, 140, 70);
  x.fillStyle = '#16121c'; x.font = '800 46px Poppins, sans-serif'; const shown = text.slice(0, n) + (typed && Math.floor(t * 3) % 2 ? '|' : '');
  x.fillText(shown, 140, 132);
  if (strike) { const sw = x.measureText(text).width * clamp((lt - 0.8) / 0.3); x.strokeStyle = '#ff3448'; x.lineWidth = 8; x.beginPath(); x.moveTo(140, 118); x.lineTo(140 + sw, 118); x.stroke(); }
  tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  if (lt < 0) return null;
  const s = back(lt / 0.4);
  return (
    <mesh position={[pos[0], pos[1] + Math.sin(t * 1.6 + pos[0] * 3) * 0.05, pos[2]]} rotation={rot} scale={[s, s, s]}>
      <planeGeometry args={[w, w * 220 / 640]} /><meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
};

// ------------------------------------------------------------ props for "camera, light, captions, music, sound"
const Prop: React.FC<{kind: string; pos: V3; t: number; t0: number}> = ({kind, pos, t, t0}) => {
  const lt = t - t0; if (lt < 0) return null;
  const k = easeOut(lt / 0.5); const from: V3 = [pos[0] * 2.6, pos[1] + 2, pos[2] + 3];
  const p: V3 = [from[0] + (pos[0] - from[0]) * k, from[1] + (pos[1] - from[1]) * k, from[2] + (pos[2] - from[2]) * k];
  const spin = (1 - k) * 4 + Math.sin(t * 1.5) * 0.15;
  const M = (c: string, r = 0.5) => <meshStandardMaterial color={c} roughness={r} />;
  return (
    <group position={p} rotation={[0.2, spin, 0.1]} scale={0.9}>
      {kind === 'camera' && (<>
        <mesh castShadow><boxGeometry args={[0.9, 0.55, 0.45]} />{M('#2f80ed')}</mesh>
        <mesh position={[0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.2, 0.26, 0.4, 24]} />{M('#1b1b22')}</mesh>
        <mesh position={[-0.2, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.26, 0.26, 0.12, 24]} />{M('#1b1b22')}</mesh>
        <mesh position={[0.25, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.26, 0.26, 0.12, 24]} />{M('#1b1b22')}</mesh>
      </>)}
      {kind === 'light' && (<>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.9, 0.9, 0.12]} />{M('#222')}</mesh>
        <mesh position={[0, 0.5, 0.07]}><planeGeometry args={[0.72, 0.72]} /><meshBasicMaterial color="#fff6e0" toneMapped={false} /></mesh>
        <mesh position={[0, -0.35, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />{M('#333')}</mesh>
        <pointLight position={[0, 0.5, 0.6]} intensity={2} distance={3} color="#fff2d0" />
      </>)}
      {kind === 'captions' && (<>
        <mesh castShadow><boxGeometry args={[1.1, 0.42, 0.06]} />{M('#111')}</mesh>
        <mesh position={[-0.12, 0, 0.04]}><boxGeometry args={[0.6, 0.1, 0.02]} /><meshBasicMaterial color="#fff" /></mesh>
        <mesh position={[0.32, 0, 0.04]}><boxGeometry args={[0.22, 0.1, 0.02]} /><meshBasicMaterial color="#ffd166" /></mesh>
      </>)}
      {kind === 'music' && (<>
        <mesh position={[-0.2, -0.3, 0]} castShadow><sphereGeometry args={[0.18, 16, 12]} />{M('#ff3448', 0.3)}</mesh>
        <mesh position={[0.25, -0.2, 0]} castShadow><sphereGeometry args={[0.18, 16, 12]} />{M('#ff3448', 0.3)}</mesh>
        <mesh position={[-0.05, 0.1, 0]} castShadow><boxGeometry args={[0.06, 0.8, 0.06]} />{M('#ff3448', 0.3)}</mesh>
        <mesh position={[0.4, 0.2, 0]} castShadow><boxGeometry args={[0.06, 0.8, 0.06]} />{M('#ff3448', 0.3)}</mesh>
        <mesh position={[0.18, 0.52, 0]} rotation={[0, 0, -0.2]} castShadow><boxGeometry args={[0.5, 0.12, 0.06]} />{M('#ff3448', 0.3)}</mesh>
      </>)}
      {kind === 'sound' && (<>
        <mesh castShadow><boxGeometry args={[0.6, 0.9, 0.5]} />{M('#2a2a33')}</mesh>
        <mesh position={[0, 0.18, 0.26]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.03, 24]} />{M('#666')}</mesh>
        <mesh position={[0, -0.22, 0.26]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.03, 24]} />{M('#666')}</mesh>
      </>)}
    </group>
  );
};

// ------------------------------------------------------------ burst sphere of colourful pieces
const Burst: React.FC<{t: number; explode: number; count?: number; radius?: number}> = ({t, explode, count = 520, radius = 1.6}) => {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const pal = ['#ff7a1a', '#ff3448', '#ffd166', '#3ddc84', '#4dc3ff', '#ffffff', '#b57bff', '#ff9ec7'];
  const data = useMemo(() => Array.from({length: count}, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    return {dir: new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), s: 0.08 + rnd(i) * 0.14, sh: rnd(i + 7), col: pal[i % pal.length], spin: rnd(i + 3) * 6};
  }), [count]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), sc = new THREE.Vector3();
    data.forEach((d, i) => {
      const rad = radius * (1 + explode * (0.6 + d.sh * 1.4)) + Math.sin(t * 2 + i) * 0.02;
      const p = d.dir.clone().multiplyScalar(rad);
      e.set(d.spin + t * 0.8 * (d.sh - 0.5), d.spin * 2 + t * 0.5, 0); q.setFromEuler(e);
      sc.set(d.s * (d.sh > 0.5 ? 2.2 : 1), d.s, d.s * (d.sh > 0.7 ? 1.8 : 1));
      m.compose(p, q, sc); ref.current.setMatrixAt(i, m); ref.current.setColorAt(i, c.set(d.col));
    });
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <group rotation={[0.3, t * 0.35, 0]}>
      <mesh><sphereGeometry args={[radius * 0.92, 32, 24]} /><meshStandardMaterial color="#f4ecff" roughness={0.6} /></mesh>
      <instancedMesh ref={ref} args={[undefined as any, undefined as any, count]} castShadow>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.45} />
      </instancedMesh>
    </group>
  );
};

// ------------------------------------------------------------ clouds
export const Cloud: React.FC<{pos: V3; s: number; t: number}> = ({pos, s, t}) => (
  <group position={[pos[0] + Math.sin(t * 0.2 + pos[0]) * 0.3, pos[1], pos[2]]} scale={s}>
    {[[0, 0, 0, 1], [0.9, -0.15, 0.1, 0.75], [-0.9, -0.2, 0, 0.7], [0.35, 0.45, -0.1, 0.7], [-0.4, 0.35, 0.1, 0.6]].map(([x, y, z, r], k) => (
      <mesh key={k} position={[x, y, z]}><sphereGeometry args={[r, 16, 12]} /><meshStandardMaterial color="#ffffff" roughness={1} /></mesh>))}
  </group>
);

// ------------------------------------------------------------ screen texture (for phone / monitors / gallery)
function screenDraw(x: CanvasRenderingContext2D, W: number, H: number, kind: string, t: number, st: number) {
  if (kind === 'landscape') {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6ec3ff'); g.addColorStop(0.6, '#bfe6ff'); g.addColorStop(0.61, '#5cc45a'); g.addColorStop(1, '#2e8b3a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff'; [[0.25, 0.25], [0.7, 0.18]].forEach(([a, b]) => { x.beginPath(); x.arc(a * W, b * H, W * 0.08, 0, 7); x.arc(a * W + W * 0.08, b * H, W * 0.06, 0, 7); x.fill(); });
  } else if (kind === 'slop') {
    for (let k = 0; k < 70; k++) { const r = rnd(k + Math.floor(t * 12) * 5); x.fillStyle = `hsl(${(r * 360 + t * 300) % 360},95%,${45 + r * 20}%)`;
      x.fillRect(r * W, rnd(k * 3) * H, 60 + r * 260, 14 + r * 60); }
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, H / 2 - 70, W, 140);
    x.fillStyle = '#ff3448'; x.font = `900 ${W * 0.12}px Poppins, sans-serif`; x.textAlign = 'center'; x.fillText('AI SLOP', W / 2 + Math.sin(t * 40) * 6, H / 2 + W * 0.045); x.textAlign = 'left';
  } else if (kind === 'prompt') {
    x.fillStyle = '#0f0f14'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#d97757'; x.beginPath(); x.arc(W * 0.42, H * 0.36, 10, 0, 7); x.fill();
    x.fillStyle = '#ddd'; x.font = `500 ${W * 0.04}px Georgia, serif`; x.fillText('Good evening, Founder', W * 0.45, H * 0.38);
    x.fillStyle = '#1f1f27'; rr(x, W * 0.08, H * 0.6, W * 0.84, H * 0.16, 14); x.fill();
    const msg = 'cool video bana do'; const n = Math.floor(clamp((st - 0.3) / 1.2) * msg.length);
    x.fillStyle = '#fff'; x.font = `600 ${W * 0.045}px Poppins, sans-serif`; x.fillText(msg.slice(0, n) + (Math.floor(t * 3) % 2 ? '|' : ''), W * 0.11, H * 0.7);
    x.fillStyle = st > 1.8 ? '#d97757' : '#444'; x.beginPath(); x.arc(W * 0.86, H * 0.68, W * 0.03, 0, 7); x.fill();
  } else if (kind === 'stage') {
    const g = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#d0303a'); g.addColorStop(1, '#3a0508'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#d82a2a'; x.fillRect(W * 0.4, H * 0.3, W * 0.2, H * 0.12); x.fillStyle = '#f2c9a0'; x.fillRect(W * 0.41, H * 0.42, W * 0.18, H * 0.2); x.fillStyle = '#1aa5a5'; x.fillRect(W * 0.42, H * 0.62, W * 0.16, H * 0.2);
  } else if (kind === 'burst') {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#b44cff'); g.addColorStop(1, '#ff4fd8'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 120; k++) { const a = k * 2.4, r = Math.sqrt(k / 120) * W * 0.28; x.fillStyle = ['#ff7a1a', '#ffd166', '#3ddc84', '#4dc3ff', '#fff'][k % 5];
      x.fillRect(W / 2 + Math.cos(a + t) * r, H / 2 + Math.sin(a + t) * r * 0.9, 12, 8); }
  } else if (kind === 'room') {
    x.fillStyle = '#2a160c'; x.fillRect(0, 0, W, H); x.fillStyle = '#7a4a2a'; x.fillRect(0, H * 0.7, W, H * 0.3);
    x.fillStyle = '#e6dcc4'; x.fillRect(W * 0.38, H * 0.38, W * 0.24, H * 0.22); x.fillStyle = '#ff5e7e'; x.fillRect(W * 0.41, H * 0.41, W * 0.18, H * 0.15);
    x.fillStyle = '#e8364f'; x.fillRect(W * 0.7, H * 0.15, W * 0.1, W * 0.1); x.fillStyle = '#2aa7e8'; x.fillRect(W * 0.18, H * 0.12, W * 0.08, W * 0.12);
  }
  x.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1);
}
const Screen: React.FC<{kind: string; t: number; st: number; w: number; h: number; pos: V3; rot?: V3}> = ({kind, t, st, w, h, pos, rot = [0, 0, 0]}) => {
  const tex = useMemo(() => { const c = document.createElement('canvas'); c.width = 640; c.height = Math.round(640 * h / w); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; }, [w, h]);
  const c = tex.image as HTMLCanvasElement; screenDraw(c.getContext('2d')!, c.width, c.height, kind, t, st); tex.needsUpdate = true;
  return <mesh position={pos} rotation={rot}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
};

// ------------------------------------------------------------ worlds
const SKY_A = () => skyTex([[0, '#1f6fe0'], [0.45, '#7fc4ff'], [0.62, '#e9f6ff'], [1, '#e9f6ff']]);
const PASTEL = () => skyTex([[0, '#ffd6ec'], [0.5, '#e9e4ff'], [1, '#cfeeff']]);
const PURPLE = () => skyTex([[0, '#5a17c9'], [0.5, '#b03cff'], [1, '#ff5fd2']]);

const WorldSky: React.FC<{t: number; st: number; shot: number}> = ({t, st, shot}) => {
  const sky = useMemo(SKY_A, []);
  const grass = useMemo(() => { const x = makeCanvas(256, 256, (c) => { c.fillStyle = '#4fae3c'; c.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1400; k++) { c.fillStyle = rnd(k) > 0.5 ? '#5cc147' : '#3f9530'; c.fillRect(rnd(k + 1) * 256, rnd(k + 2) * 256, 2, 5); } }); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(10, 10); return x; }, []);
  return (<>
    <Sky tex={sky} />
    <fog attach="fog" args={['#e9f6ff', 14, 34]} />
    <hemisphereLight args={['#cfe8ff', '#4fae3c', 0.9]} />
    <directionalLight position={[5, 8, 4]} intensity={2.2} color="#fff1dc" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[80, 80]} /><meshLambertMaterial map={grass} /></mesh>
    <Cloud pos={[-5, 4.5, -8]} s={1.4} t={t} /><Cloud pos={[4.5, 5.2, -10]} s={1.8} t={t} /><Cloud pos={[0, 6.5, -14]} s={2.2} t={t} /><Cloud pos={[-9, 3.5, -12]} s={1.6} t={t} />
    {/* floating desk with monitor showing a pretty video */}
    <group position={[0.5, 0, -2.4]}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow><boxGeometry args={[3.6, 0.1, 1.2]} /><meshStandardMaterial color="#f2e6d0" /></mesh>
      <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.1, 0.9, 0.1]} /><meshStandardMaterial color="#ddd" /></mesh>
      <mesh position={[0, 2.0, -0.3]} castShadow><boxGeometry args={[2.3, 1.45, 0.08]} /><meshStandardMaterial color="#d9d9e0" /></mesh>
      <Screen kind="landscape" t={t} st={st} w={2.15} h={1.3} pos={[0, 2.0, -0.25]} />
      <mesh position={[1.4, 1.25, 0.1]} castShadow><cylinderGeometry args={[0.16, 0.12, 0.6, 16]} /><meshStandardMaterial color="#e07a3c" /></mesh>
      {[0, 1, 2, 3, 4].map((k) => <mesh key={k} position={[1.4 + (k - 2) * 0.05, 1.9, 0.1]} rotation={[0, 0, (k - 2) * 0.15]} castShadow><boxGeometry args={[0.07, 0.9, 0.12]} /><meshStandardMaterial color={k % 2 ? '#3fae5f' : '#2f8f4e'} /></mesh>)}
    </group>
    <VoxelWord word="REEL" s={0.18} color="#e23535" pos={[0.4, 0, -0.6]} t={t} t0={0.6} emissive={0.05} />
    {shot >= 1 && <VoxelWord word="X" s={0.26} color="#ff2a3a" pos={[2.9, 0.2, 0.2]} t={t} t0={t - st + 0.2} emissive={0.25} />}
  </>);
};

const WorldStage: React.FC<{t: number; st: number; shot: number; t0: number}> = ({t, st, shot, t0}) => {
  const asks: [string, string, string, V3][] = [
    ['ankit.dev', 'secret kya hai?', '#7c4dff', [-2.3, 2.6, -0.4]], ['riya.makes', 'kaise banaya??', '#ff7a1a', [2.4, 2.9, -0.6]],
    ['sahil', 'editor kaun hai?', '#3ddc84', [-2.6, 1.3, 0.2]], ['meera.ai', 'app ka naam batao', '#ff3448', [2.6, 1.5, 0.1]],
    ['dev_kumar', 'prompt share karo', '#4dc3ff', [-0.9, 3.5, -1.2]], ['tanu', 'software?', '#ffd166', [1.1, 3.6, -1.3]],
  ];
  return (<>
    <color attach="background" args={['#2a0306']} />
    <fog attach="fog" args={['#2a0306', 6, 16]} />
    <hemisphereLight args={['#ff8a8a', '#200', 0.5]} />
    <spotLight position={[0, 6, 3]} angle={0.55} penumbra={0.6} intensity={60} distance={14} decay={1.6} color="#ffd9c9" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} target-position={[0, 0.8, 0]} />
    <pointLight position={[0, 2, -3]} intensity={18} distance={8} color="#ff2a3a" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[12, 48]} /><meshStandardMaterial color="#5a0a10" roughness={0.35} metalness={0.2} /></mesh>
    <mesh position={[0, 4, -5]}><planeGeometry args={[30, 12]} /><meshStandardMaterial color="#3a0408" /></mesh>
    <Chibi pos={[-0.35, 0, 0.3]} rotY={0.25} t={t} talk scale={1.15} />
    {/* phone */}
    <group position={[1.05, 1.2, 0.1]} rotation={[0, -0.25, 0.04]}>
      <mesh castShadow><boxGeometry args={[0.72, 1.4, 0.07]} /><meshStandardMaterial color="#111" roughness={0.3} /></mesh>
      <Screen kind="landscape" t={t} st={st} w={0.64} h={1.3} pos={[0, 0, 0.04]} />
    </group>
    {shot === 2 && asks.map(([who, txt, col, p], k) => <Card key={k} pos={p} t={t} t0={t0 + 0.15 + k * 0.28} who={who} text={txt} color={col} w={1.9} />)}
  </>);
};

const WorldCloseup: React.FC<{t: number; st: number; t0: number}> = ({t, st, t0}) => (<>
  <color attach="background" args={['#24030a']} />
  <hemisphereLight args={['#ffb0b0', '#200', 0.7]} />
  <spotLight position={[-2, 4, 4]} angle={0.6} penumbra={0.7} intensity={50} distance={12} color="#ffe2d2" target-position={[0.8, 1.5, 0]} />
  <pointLight position={[2, 2, -2]} intensity={10} distance={6} color="#ff3a4a" />
  <Chibi pos={[1.25, -0.2, 0]} rotY={-0.35} t={t} talk scale={1.35} />
  <Card pos={[-0.65, 1.95, 0.55]} t={t} t0={t0 + 0.1} who="vedanshurathi" text="cool video bana do" color="#d97757" w={2.0} typed rot={[0, 0.25, 0]} />
  <Card pos={[-1.6, 1.0, -0.4]} t={t} t0={t0 + 0.9} who="viewer" text="prompt?" color="#4dc3ff" w={1.2} strike rot={[0, 0.35, 0]} />
</>);

const WorldDesk: React.FC<{t: number; st: number; kind: string; founder?: boolean; t0: number}> = ({t, st, kind, founder = false, t0}) => {
  const wall = useMemo(() => { const x = makeCanvas(512, 512, (c) => { c.fillStyle = '#4a2a1a'; c.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 8; k++) { c.fillStyle = `rgba(0,0,0,${0.05 + (k % 3) * 0.04})`; c.fillRect(k * 64, 0, 60, 512); c.fillStyle = 'rgba(20,8,4,0.7)'; c.fillRect(k * 64 + 60, 0, 4, 512); } });
    x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(4, 1); return x; }, []);
  const turn = founder ? back((t - t0) / 0.7) : 0;
  return (<>
    <color attach="background" args={['#120806']} />
    <fog attach="fog" args={['#120806', 6, 14]} />
    <hemisphereLight args={['#6f7dff', '#2a1608', 0.55]} />
    <spotLight position={[-1.0, 1.75, -1.3]} angle={1.1} penumbra={0.7} intensity={16} distance={6} decay={1.4} color="#ffb067" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} target-position={[0.2, 0.8, -1.2]} />
    <pointLight position={[0, 1.4, -0.7]} intensity={2.5} distance={2.6} color={kind === 'slop' ? '#ff6bd5' : '#a9c6ff'} />
    {founder && <pointLight position={[0.8, 1.9, 1.2]} intensity={6} distance={5} color="#ffd2b0" />}
    {founder && <pointLight position={[0.9, 2.3, -2.0]} intensity={4} distance={3} color="#ff4d6d" />}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[14, 14]} /><meshLambertMaterial color="#6a4228" /></mesh>
    <mesh position={[0, 3, -2.3]} receiveShadow><planeGeometry args={[14, 6]} /><meshLambertMaterial map={wall} /></mesh>
    <mesh position={[0, 0.84, -1.55]} castShadow receiveShadow><boxGeometry args={[2.6, 0.07, 1.0]} /><meshStandardMaterial color="#8b5a3a" roughness={0.6} /></mesh>
    {/* big monitor */}
    <mesh position={[0, 1.5, -1.85]} castShadow><boxGeometry args={[1.6, 0.95, 0.06]} /><meshStandardMaterial color="#141418" /></mesh>
    <Screen kind={kind} t={t} st={st} w={1.5} h={0.86} pos={[0, 1.5, -1.81]} />
    <mesh position={[0, 0.98, -1.85]}><boxGeometry args={[0.1, 0.3, 0.1]} /><meshStandardMaterial color="#222" /></mesh>
    <mesh position={[0, 0.9, -1.25]}><boxGeometry args={[0.95, 0.03, 0.3]} /><meshStandardMaterial color="#eae4d8" /></mesh>
    {/* lamp + plant + little robot monitor + wall art */}
    <mesh position={[-1.0, 1.25, -1.75]}><boxGeometry args={[0.04, 0.7, 0.04]} /><meshStandardMaterial color="#222" /></mesh>
    <mesh position={[-1.0, 1.66, -1.48]}><sphereGeometry args={[0.07, 12, 12]} /><meshBasicMaterial color="#ffe0b0" toneMapped={false} /></mesh>
    <mesh position={[1.05, 1.02, -1.7]} castShadow><cylinderGeometry args={[0.14, 0.11, 0.28, 16]} /><meshStandardMaterial color="#b5653d" /></mesh>
    {[0, 1, 2, 3, 4].map((k) => <mesh key={k} position={[1.05 + (k - 2) * 0.04, 1.35, -1.7]} rotation={[0.2, k, (k - 2) * 0.25]} castShadow><boxGeometry args={[0.07, 0.42, 0.15]} /><meshStandardMaterial color={k % 2 ? '#3fae5f' : '#2f8f4e'} /></mesh>)}
    <group position={[0.85, 1.05, -1.2]} rotation={[0, -0.4, 0]}>
      <mesh castShadow><boxGeometry args={[0.32, 0.28, 0.28]} /><meshStandardMaterial color="#e6dcc4" /></mesh>
      <Screen kind="stage" t={t} st={st} w={0.24} h={0.18} pos={[0, 0.02, 0.141]} />
    </group>
    <mesh position={[0.95, 2.25, -2.27]}><boxGeometry args={[0.5, 0.5, 0.04]} /><meshStandardMaterial color="#e8364f" emissive="#ff2a4d" emissiveIntensity={founder ? 1 : 0.2} /></mesh>
    <mesh position={[-0.7, 2.35, -2.27]}><boxGeometry args={[0.38, 0.58, 0.04]} /><meshStandardMaterial color="#2aa7e8" emissive="#2ab6ff" emissiveIntensity={founder ? 1 : 0.2} /></mesh>
    <mesh position={[1.6, 1.85, -2.27]}><boxGeometry args={[0.3, 0.3, 0.04]} /><meshStandardMaterial color="#f5c542" emissive="#ffcc33" emissiveIntensity={founder ? 0.8 : 0.15} /></mesh>
    {founder && <VoxelWord word="15" s={0.09} color="#ffd166" pos={[-1.55, 1.85, -2.22]} t={t} t0={t0 + 0.4} emissive={0.6} />}
    {founder && Array.from({length: 14}).map((_, k) => (
      <mesh key={k} position={[-2.2 + k * 0.33, 2.85 - Math.sin((k / 13) * Math.PI) * 0.18, -2.25]}>
        <sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color={['#ffd166', '#ff6b6b', '#4dd4ff'][k % 3]} toneMapped={false} />
      </mesh>))}
    <Chibi pos={[0, 0.0, -0.45]} rotY={Math.PI * (1 - turn)} t={t} variant={founder ? 'founder' : 'beanie'} wave={founder ? clamp((t - t0 - 0.6) / 0.3) : 0} scale={0.95} />
  </>);
};

const WorldPastel: React.FC<{t: number; st: number}> = ({t, st}) => {
  const sky = useMemo(PASTEL, []);
  const steps = 7;
  const k = clamp(st / 2.8) * (steps - 1);           // the chibi climbs one step at a time
  const i = Math.floor(k), f = k - i;
  const hop = Math.sin(f * Math.PI) * 0.22;
  return (<>
    <Sky tex={sky} />
    <hemisphereLight args={['#ffffff', '#ffd0e0', 1.0]} />
    <directionalLight position={[4, 7, 5]} intensity={2.3} color="#fff4e8" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshLambertMaterial color="#fde8f2" /></mesh>
    {Array.from({length: steps}).map((_, s) => (
      <mesh key={s} position={[s * 0.55, (s + 1) * 0.22, 0]} castShadow receiveShadow><boxGeometry args={[0.55, (s + 1) * 0.44, 1.3]} /><meshStandardMaterial color="#ff6a1a" roughness={0.6} /></mesh>))}
    <Chibi pos={[(i + f) * 0.55, (i + 1) * 0.44 + f * 0.44 + hop, 0]} rotY={Math.PI / 2 - 0.4} t={t} step={k} scale={0.8} />
    {/* glass orb with a tiny world inside */}
    <group position={[-2.2, 1.4, -0.8]}>
      <mesh><sphereGeometry args={[1.25, 48, 32]} /><meshStandardMaterial color="#cfeaff" transparent opacity={0.28} roughness={0.05} metalness={0.1} /></mesh>
      <mesh position={[0, -0.55, 0]}><cylinderGeometry args={[1.0, 1.0, 0.2, 32]} /><meshStandardMaterial color="#6cc35a" /></mesh>
      <Cloud pos={[0, 0.3, 0]} s={0.35} t={t} />
      <mesh position={[0.4, 0.5, 0.3]}><torusGeometry args={[0.3, 0.035, 12, 40]} /><meshBasicMaterial color="#ffe58a" toneMapped={false} /></mesh>
    </group>
    <mesh position={[2.8, 3.5, -2]} rotation={[0.4, 0.4, 0]}><boxGeometry args={[1.4, 1.4, 1.4]} /><meshStandardMaterial color="#fffbe0" /></mesh>
    <mesh position={[-3.5, 3.2, -3]}><sphereGeometry args={[0.9, 32, 24]} /><meshStandardMaterial color="#ffd23f" /></mesh>
    <VoxelWord word="AI" s={0.12} color="#7c4dff" pos={[2.0, 2.6, -1.2]} t={t} t0={t - st + 0.5} emissive={0.15} />
  </>);
};

const WorldPurple: React.FC<{t: number; st: number; shot: number; line?: Line}> = ({t, st, shot, line}) => {
  const sky = useMemo(PURPLE, []);
  const explode = shot === 6 ? clamp((st - 1.2) / 0.6) * 0 : 0.12 + Math.sin(t * 2) * 0.03;
  const props: [string, V3][] = [['camera', [-2.1, 1.4, 0.8]], ['light', [2.2, 1.6, 0.6]], ['captions', [-1.9, -0.4, 1.0]], ['music', [2.0, -0.3, 1.1]], ['sound', [0, 2.6, 0.6]]];
  const words = line ? line.text.split(' ') : [];
  const wt = (w: string) => { const k = words.findIndex((x) => x.toLowerCase().startsWith(w)); return line ? line.start + ((line.end - line.start) * Math.max(0, k)) / words.length : 0; };
  return (<>
    <Sky tex={sky} />
    <hemisphereLight args={['#ffffff', '#7a2bd6', 1.0]} />
    <directionalLight position={[3, 5, 6]} intensity={2.2} color="#ffffff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[-4, 0, 3]} intensity={20} distance={10} color="#ff5fd2" />
    <group position={[0, 1.1, -0.5]}>
      <Burst t={t} explode={shot === 6 ? clamp((st - 0.35) / 0.5) * 0.9 - clamp((st - 0.9) / 0.5) * 0.75 : explode} radius={shot === 6 ? 1.3 : 1.7} />
    </group>
    {shot === 6 && <VoxelWord word="CODE" s={0.14} color="#ffd166" pos={[0.0, 0.15, 1.6]} t={t} t0={t - st} stagger={0.07} emissive={0.45} />}
    {shot === 7 && props.map(([kind, p]) => <Prop key={kind} kind={kind} pos={p} t={t} t0={wt(kind.slice(0, 4))} />)}
  </>);
};

const WorldGallery: React.FC<{t: number; st: number; t0: number}> = ({t, st, t0}) => {
  const kinds = ['landscape', 'stage', 'burst', 'room', 'slop'];
  return (<>
    <color attach="background" args={['#0d0306']} />
    <fog attach="fog" args={['#0d0306', 6, 18]} />
    <hemisphereLight args={['#ffb0b0', '#200', 0.4]} />
    <spotLight position={[0, 5, 4]} angle={0.8} penumbra={0.7} intensity={30} distance={14} color="#ffe2d2" target-position={[0, 1, -1]} castShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#4a0a10" roughness={0.3} metalness={0.25} /></mesh>
    {kinds.map((k, i) => (
      <group key={k} position={[(i - 2) * 1.75, 1.35 + (i % 2) * 0.15, -1.6 - Math.abs(i - 2) * 0.35]} rotation={[0, -(i - 2) * 0.18, 0]}>
        <mesh castShadow><boxGeometry args={[1.62, 0.98, 0.05]} /><meshStandardMaterial color="#161616" /></mesh>
        <Screen kind={k} t={t} st={st} w={1.52} h={0.88} pos={[0, 0, 0.03]} />
      </group>))}
    <Card pos={[-1.1, 0.75, 0.9]} t={t} t0={t0 + 0.2} who="you" text="AI" color="#ff7a1a" w={1.8} typed />
    <group position={[1.3, 0.55, 0.8]} rotation={[0, -0.3, 0.06]}>
      <mesh castShadow><boxGeometry args={[0.9, 1.1, 0.04]} /><meshStandardMaterial color="#fafafa" /></mesh>
      <mesh position={[0, 0.25, 0.03]}><boxGeometry args={[0.6, 0.06, 0.01]} /><meshBasicMaterial color="#333" /></mesh>
      {[0, 1, 2, 3].map((k) => <mesh key={k} position={[-0.05, 0.05 - k * 0.12, 0.03]}><boxGeometry args={[0.5, 0.035, 0.01]} /><meshBasicMaterial color="#999" /></mesh>)}
      <mesh position={[0.15, -0.42, 0.03]}><boxGeometry args={[0.38, 0.12, 0.01]} /><meshBasicMaterial color="#ff3448" /></mesh>
    </group>
  </>);
};

// ------------------------------------------------------------ camera per shot
type Cam = {p: V3; t: V3; d?: V3; fov?: number};
const CAMS: Cam[] = [
  {p: [0.6, 1.3, 6.2], t: [0.4, 1.3, -1.0], d: [0, 0.3, -1.4]},          // 0 sky: REEL drops
  {p: [3.4, 1.4, 4.2], t: [1.4, 1.1, -0.6], d: [-0.6, 0, -0.6]},         // 1 sky: big red X
  {p: [0, 1.9, 6.0], t: [0, 1.8, 0], d: [0, 0, -1.2]},                    // 2 red stage + comment cards
  {p: [0.6, 1.9, 3.4], t: [0.3, 1.7, 0], d: [-0.1, 0, -0.3]},            // 3 close-up chibi + prompt card
  {p: [1.05, 1.75, -0.2], t: [0, 1.5, -1.8], d: [-0.15, -0.05, -0.2]},    // 4 over-shoulder: AI slop
  {p: [5.6, 3.0, 6.2], t: [0.6, 1.6, 0], d: [-1.2, 0.3, -0.8]},          // 5 pastel: climb the stairs
  {p: [0, 1.2, 6.6], t: [0, 1.1, 0], d: [0, 0, -1.4]},                    // 6 purple: CODE
  {p: [0, 1.4, 6.8], t: [0, 1.2, 0], d: [0.8, 0.2, -0.6]},               // 7 purple: sphere + props
  {p: [1.0, 1.6, 2.0], t: [0, 1.25, -0.8], d: [-0.4, 0, -0.3]},          // 8 desk: founder turns + 15
  {p: [-1.6, 1.8, 5.2], t: [0, 1.1, -0.6], d: [2.2, 0, -0.6]},           // 9 gallery truck
];
const Rig: React.FC<{shot: number; st: number; dur: number; t: number}> = ({shot, st, dur, t}) => {
  const {camera} = useThree();
  const c = CAMS[shot], d = c.d || [0, 0, 0];
  const k = easeInOut(clamp(st / Math.max(0.5, dur))) * 0.85 + clamp(st / Math.max(0.5, dur)) * 0.15;
  const whip = 1 - easeOut(st / 0.35);                       // short eased arrival on every cut
  camera.position.set(c.p[0] + d[0] * k + whip * 0.5, c.p[1] + d[1] * k + whip * 0.15, c.p[2] + d[2] * k + whip * 0.6);
  camera.position.x += Math.sin(t * 0.9) * 0.015; camera.position.y += Math.sin(t * 1.3 + 1) * 0.01;
  camera.lookAt(c.t[0], c.t[1], c.t[2]);
  (camera as THREE.PerspectiveCamera).fov = c.fov || 40; camera.updateProjectionMatrix();
  return null;
};

// ------------------------------------------------------------ the film
export const Film: React.FC<FilmProps> = ({lines, total}) => {
  const frame = useCurrentFrame(); const {fps, width, height} = useVideoConfig();
  const UI = width / 1920;
  const t = frame / fps;
  const starts = [0, ...lines.slice(1).map((l) => l.start - 0.25)];
  let shot = 0; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) shot = k;
  const st = t - starts[shot]; const dur = (shot + 1 < starts.length ? starts[shot + 1] : total) - starts[shot];
  const caption = lines.find((l) => t >= l.start - 0.05 && t < l.end + 0.35);
  const KEY = new Set(['APP,', 'APP', 'EDITOR.', 'SECRET', 'BEKAAR', 'SAHI', 'CODE.', 'FRAME', '15', 'FOUNDER', 'AI,', 'AI']);
  const flash = shot > 0 ? 1 - clamp(st / 0.18) : 0;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <style>{`@font-face{font-family:Poppins;font-weight:700;src:url(${staticFile('Poppins-ExtraBold.ttf')})}
               @font-face{font-family:Poppins;font-weight:800;src:url(${staticFile('Poppins-ExtraBold.ttf')})}
               @font-face{font-family:Poppins;font-weight:900;src:url(${staticFile('Poppins-Black.ttf')})}`}</style>
      <ThreeCanvas width={width} height={height} shadows dpr={1}
        gl={{toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, antialias: false}} camera={{fov: 40, near: 0.05, far: 100}}>
        <Rig shot={shot} st={st} dur={dur} t={t} />
        {shot <= 1 && <WorldSky t={t} st={st} shot={shot} />}
        {shot === 2 && <WorldStage t={t} st={st} shot={shot} t0={starts[2]} />}
        {shot === 3 && <WorldCloseup t={t} st={st} t0={starts[3]} />}
        {shot === 4 && <WorldDesk t={t} st={st} kind="slop" t0={starts[4]} />}
        {shot === 5 && <WorldPastel t={t} st={st} />}
        {(shot === 6 || shot === 7) && <WorldPurple t={t} st={st} shot={shot} line={lines[7]} />}
        {shot === 8 && <WorldDesk t={t} st={st} kind="room" founder t0={starts[8]} />}
        {shot === 9 && <WorldGallery t={t} st={st} t0={starts[9]} />}
      </ThreeCanvas>
      {caption && (
        <div style={{position: 'absolute', top: 64 * UI, left: 90 * UI, right: 90 * UI, fontFamily: 'Poppins', fontWeight: 800,
          fontSize: 66 * UI, color: '#fff', textShadow: `0 ${4 * UI}px ${22 * UI}px rgba(0,0,0,0.75)`, lineHeight: 1.15}}>
          {caption.text.split(' ').map((w, k, arr) => {
            const ws = caption.start + ((caption.end - caption.start) * k) / arr.length;
            const a = clamp((t - ws) / 0.12); const key = KEY.has(w.toUpperCase());
            return <span key={k} style={{opacity: a, display: 'inline-block', transform: `translateY(${(1 - easeOut(a)) * 14 * UI}px)`,
              color: key ? '#ff3448' : '#fff', marginRight: 16 * UI}}>{w}</span>;
          })}
        </div>
      )}
      {shot === 9 && (
        <div style={{position: 'absolute', bottom: 70 * UI, width: '100%', textAlign: 'center', fontFamily: 'Poppins', fontWeight: 900, fontSize: 74 * UI, color: '#fff',
          textShadow: `0 ${4 * UI}px ${24 * UI}px rgba(0,0,0,0.8)`, transform: `scale(${back((st - 0.3) / 0.4)})`}}>
          Comment <span style={{color: '#ff3448'}}>“AI”</span> 💬</div>
      )}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)'}} />
      <AbsoluteFill style={{background: '#fff', opacity: flash * 0.35}} />
      <AbsoluteFill style={{background: '#000', opacity: 1 - clamp(t / 0.4)}} />
    </AbsoluteFill>
  );
};
