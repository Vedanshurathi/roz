// Cinematic voxel "cozy desk at night" film, 1920x1080, every frame from code.
// Shots are driven by the voiceover timeline passed in props (seconds).
import React, {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';

type Line = {text: string; start: number; end: number};
export type RoomProps = {lines: Line[]; total: number};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = (x: number) => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ----------------------------------------------------------------- camera keyframes per shot
type Cam = {p: [number, number, number]; t: [number, number, number]; drift?: [number, number, number]};
const SHOTS: Cam[] = [
  {p: [3.4, 2.5, 4.4], t: [0, 1.15, -1.4], drift: [-0.5, -0.15, -0.8]},     // 0 establishing, dolly in
  {p: [2.2, 1.9, 2.6], t: [0, 1.25, -1.4], drift: [0.3, 0, -0.2]},          // 1 no app / no editor
  {p: [-2.6, 2.3, 3.2], t: [0, 1.4, -1.2], drift: [0.5, 0, -0.3]},          // 2 everyone asks
  {p: [0.95, 1.7, -0.05], t: [0, 1.36, -1.3], drift: [-0.12, -0.05, -0.15]}, // 3 prompt typed (over the shoulder)
  {p: [0.0, 1.36, -0.42], t: [0, 1.36, -1.3], drift: [0, 0, -0.06]},        // 4 bad result, screen fills frame
  {p: [3.9, 2.7, 5.0], t: [0, 1.2, -1.2], drift: [-0.6, -0.2, -0.6]},       // 5 the good one: pull back, room lights up
  {p: [0.0, 1.38, -0.6], t: [0, 1.38, -1.3], drift: [0, 0, -0.05]},         // 6 CODE close
  {p: [0.04, 1.36, -0.4], t: [0, 1.36, -1.3], drift: [-0.04, 0, -0.03]},    // 7 XP panel
  {p: [0.55, 1.3, 1.7], t: [0, 1.05, -0.6], drift: [-0.25, 0, -0.25]},      // 8 founder turns around
  {p: [0, 2.1, 4.8], t: [0, 1.2, -1.0], drift: [0, 0.2, 0.6]},              // 9 comment CTA, pull back
];

const CameraRig: React.FC<{t: number; starts: number[]; total: number}> = ({t, starts, total}) => {
  const {camera} = useThree();
  let i = 0; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
  const s0 = starts[i], s1 = i + 1 < starts.length ? starts[i + 1] : total;
  const pos = (k: number, local: number) => {
    const sh = SHOTS[k], d = sh.drift || [0, 0, 0];
    return new THREE.Vector3(sh.p[0] + d[0] * local, sh.p[1] + d[1] * local, sh.p[2] + d[2] * local);
  };
  const local = clamp((t - s0) / Math.max(0.1, s1 - s0));
  let p = pos(i, easeInOut(local) * 0.9 + local * 0.1);
  let tg = new THREE.Vector3(...SHOTS[i].t);
  // 0.7 s eased move from the previous shot's end framing
  const TR = 0.7;
  if (i > 0 && t - s0 < TR) {
    const k = easeInOut((t - s0) / TR);
    const pPrev = pos(i - 1, 1), tPrev = new THREE.Vector3(...SHOTS[i - 1].t);
    p = pPrev.lerp(p, k); tg = tPrev.lerp(tg, k);
  }
  // gentle handheld breathing
  p.x += Math.sin(t * 0.9) * 0.012; p.y += Math.sin(t * 1.3 + 1) * 0.008;
  camera.position.copy(p); camera.lookAt(tg);
  (camera as THREE.PerspectiveCamera).fov = 38;
  camera.updateProjectionMatrix();
  return null;
};

// ----------------------------------------------------------------- canvas textures
function useCanvas(w: number, h: number) {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    return {c, ctx: c.getContext('2d')!, tex};
  }, [w, h]);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// what the retro computer screen shows, per shot
function drawScreen(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, shot: number, st: number, lines: Line[]) {
  const F = 'Poppins, sans-serif';
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
  if (shot <= 2) {             // idle: boot / REC screen
    const on = clamp((t - 0.3) / 0.4);
    ctx.globalAlpha = on;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2440'); g.addColorStop(1, '#3a1a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4757'; ctx.beginPath(); ctx.arc(80, 80, 22 * (0.8 + 0.2 * Math.sin(t * 6)), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 46px ${F}`; ctx.fillText('REC', 118, 96);
    ctx.font = `800 92px ${F}`; ctx.textAlign = 'center'; ctx.fillText('reel.mp4', W / 2, H / 2 + 20);
    ctx.font = `600 34px ${F}`; ctx.fillStyle = '#b8b2d8'; ctx.fillText('rendering in code…', W / 2, H / 2 + 80);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  } else if (shot === 3) {     // prompt UI with typed text
    ctx.fillStyle = '#e9e4d8'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b2b3a'; ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = '#fff'; ctx.font = `700 34px ${F}`; ctx.fillText('ai — new video', 30, 47);
    ctx.fillStyle = '#555'; ctx.font = `600 32px ${F}`; ctx.fillText('Describe your video:', 50, 150);
    ctx.fillStyle = '#fff'; roundRect(ctx, 50, 175, W - 100, 120, 18); ctx.fill(); ctx.strokeStyle = '#999'; ctx.lineWidth = 3; ctx.stroke();
    const msg = 'cool video bana do'; const n = Math.floor(clamp((st - 0.4) / 1.4) * msg.length);
    ctx.fillStyle = '#111'; ctx.font = `600 52px monospace`; ctx.fillText(msg.slice(0, n) + (Math.floor(t * 3) % 2 ? '|' : ''), 80, 255);
    const press = st > 2.2;
    ctx.fillStyle = press ? '#7c4dff' : '#3a3a4a'; roundRect(ctx, W - 330, 330, 280, 90, 45); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 40px ${F}`; ctx.fillText('Generate ▶', W - 300, 390);
  } else if (shot === 4) {     // AI slop: glitchy rainbow mush
    for (let k = 0; k < 60; k++) {
      const s = Math.sin(k * 12.9898 + Math.floor(t * 12) * 3.1) * 43758.5453; const r = s - Math.floor(s);
      ctx.fillStyle = `hsl(${(r * 360 + t * 200) % 360}, 90%, ${45 + r * 20}%)`;
      ctx.fillRect(r * W, ((k * 37) % 17) / 17 * H, 80 + r * 300, 18 + r * 70);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, H / 2 - 90, W, 180);
    ctx.fillStyle = '#ff4757'; ctx.font = `900 120px ${F}`; ctx.textAlign = 'center';
    ctx.fillText('AI SLOP', W / 2 + (Math.random() - 0.5) * 0, H / 2 + 42); ctx.textAlign = 'left';
  } else if (shot === 5) {     // the good one: mini sunset scene
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff9a5a'); g.addColorStop(0.6, '#ff5e7e'); g.addColorStop(1, '#3b1d5c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(W / 2, H * 0.62, 120, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1640'; for (let k = 0; k < 8; k++) ctx.fillRect(k * 130 - (t * 40) % 130, H * 0.66 - (k % 3) * 40, 110, 400);
    ctx.fillStyle = '#fff'; ctx.font = `900 92px ${F}`; ctx.textAlign = 'center'; ctx.fillText('✨ TASTEFUL', W / 2, 140); ctx.textAlign = 'left';
  } else if (shot === 6) {     // code typing
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    const code = ['const reel = new Film({fps: 30});', 'reel.camera.dolly(3.4, 2.5, 4.4);', 'reel.light("lamp", {warm: true});',
      'reel.captions.wordByWord(voice);', 'reel.music.duckUnder(voice);', 'reel.sound.whoosh(atCuts);', 'reel.render("1080x1920");'];
    const shown = Math.floor(st * 22);
    let c = 0; ctx.font = `600 34px monospace`;
    code.forEach((ln, k) => {
      const take = clamp(shown - c, 0, ln.length); c += ln.length;
      ctx.fillStyle = '#6e7681'; ctx.fillText(String(k + 1).padStart(2, ' '), 30, 200 + k * 62);
      ctx.fillStyle = k % 2 ? '#79c0ff' : '#ffa657'; ctx.fillText(ln.slice(0, take), 100, 200 + k * 62);
    });
  } else if (shot === 7) {     // XP panel
    ctx.fillStyle = '#16181f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = `800 38px ${F}`; ctx.fillText('Experience: Video Editor', 50, 215);
    const xp = Math.floor(easeOut(st / 1.6) * 10000);
    ctx.font = `700 30px monospace`; ctx.textAlign = 'right'; ctx.fillText(`${xp.toLocaleString('en-US')} / 10,000 XP`, W - 50, 215); ctx.textAlign = 'left';
    ctx.fillStyle = '#333847'; roundRect(ctx, 50, 250, W - 100, 46, 23); ctx.fill();
    const gg = ctx.createLinearGradient(50, 0, W - 50, 0); gg.addColorStop(0, '#ffb347'); gg.addColorStop(1, '#ffd166');
    ctx.fillStyle = gg; roundRect(ctx, 50, 250, Math.max(46, (W - 100) * easeOut(st / 1.6)), 46, 23); ctx.fill();
    const items = ['camera', 'light', 'captions', 'music', 'sound'];
    items.forEach((it, k) => {
      const on = st > 0.5 + k * 0.55;
      const x = 50 + (k % 3) * 320, y = 360 + Math.floor(k / 3) * 130;
      ctx.fillStyle = on ? '#1f3d2b' : '#24262f'; roundRect(ctx, x, y, 290, 96, 20); ctx.fill();
      ctx.fillStyle = on ? '#3ddc84' : '#666'; ctx.font = `900 46px ${F}`; ctx.fillText(on ? '✓' : '○', x + 24, y + 64);
      ctx.fillStyle = '#fff'; ctx.font = `700 40px ${F}`; ctx.fillText(it, x + 84, y + 62);
    });
  } else {                     // founder / CTA: profile card
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b1055'); g.addColorStop(1, '#7c1d3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = `900 84px ${F}`; ctx.textAlign = 'center';
    ctx.fillText('@vedanshurathi', W / 2, H / 2 - 10);
    ctx.fillStyle = '#ffd166'; ctx.font = `700 40px ${F}`; ctx.fillText('15 · founder · RozBazaar', W / 2, H / 2 + 60); ctx.textAlign = 'left';
  }
  // CRT scanlines + vignette
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

const Screen: React.FC<{t: number; shot: number; st: number; lines: Line[]}> = ({t, shot, st, lines}) => {
  const {c, ctx, tex} = useCanvas(1600, 1200);
  ctx.setTransform(1600 / 1024, 0, 0, 1200 / 768, 0, 0);
  drawScreen(ctx, 1024, 768, t, shot, st, lines); tex.needsUpdate = true;
  return (
    <mesh position={[0, 1.36, -1.262]}>
      <planeGeometry args={[0.62, 0.465]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

// ----------------------------------------------------------------- props
const Box: React.FC<{p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number]; e?: string; ei?: number; rough?: number}> =
  ({p, s, c, r = [0, 0, 0], e, ei = 0, rough = 0.75}) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} roughness={rough} emissive={e || '#000'} emissiveIntensity={ei} />
  </mesh>
);

function plankTexture(base: string, line: string, vertical = false) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d')!;
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 8; k++) {
    x.fillStyle = `rgba(0,0,0,${0.05 + (k % 3) * 0.03})`;
    if (vertical) x.fillRect(k * 64, 0, 60, 512); else x.fillRect(0, k * 64, 512, 60);
    x.fillStyle = line; if (vertical) x.fillRect(k * 64 + 60, 0, 4, 512); else x.fillRect(0, k * 64 + 60, 512, 4);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

const Character: React.FC<{turn: number; wave: number; t: number}> = ({turn, wave, t}) => {
  // voxel founder: black hair, red polo, dark trousers. rotation PI = facing the desk.
  const skin = '#c98b62', hair = '#17110f', shirt = '#d3202f', pants = '#1f2433';
  const rot = Math.PI * (1 - turn);
  const armZ = -2.4 + Math.sin(t * 9) * 0.35;   // waving right arm
  return (
    <group position={[0, 0, -0.45]} rotation={[0, rot, 0]}>
      {/* chair */}
      <Box p={[0, 0.5, 0]} s={[0.62, 0.08, 0.6]} c="#2b2b33" />
      <Box p={[0, 0.82, -0.29]} s={[0.62, 0.6, 0.07]} c="#2b2b33" />
      <Box p={[0, 0.25, 0]} s={[0.07, 0.45, 0.07]} c="#555" />
      {/* legs (seated) */}
      <Box p={[-0.11, 0.6, 0.16]} s={[0.17, 0.15, 0.42]} c={pants} />
      <Box p={[0.11, 0.6, 0.16]} s={[0.17, 0.15, 0.42]} c={pants} />
      <Box p={[-0.11, 0.33, 0.36]} s={[0.16, 0.42, 0.16]} c={pants} />
      <Box p={[0.11, 0.33, 0.36]} s={[0.16, 0.42, 0.16]} c={pants} />
      {/* torso */}
      <Box p={[0, 0.9, -0.02]} s={[0.46, 0.5, 0.26]} c={shirt} rough={0.9} />
      <Box p={[0, 1.13, 0.1]} s={[0.2, 0.05, 0.03]} c="#f2f2f2" />
      {/* arms */}
      <Box p={[-0.3, 0.92, 0.05]} s={[0.13, 0.42, 0.14]} c={shirt} r={[-0.5, 0, 0]} />
      <group position={[0.3, 1.1, 0]} rotation={[0, 0, wave > 0 ? armZ * wave + 0 * (1 - wave) : 0]}>
        <Box p={[0, -0.2, 0.05]} s={[0.13, 0.42, 0.14]} c={shirt} r={[wave > 0 ? 0 : -0.5, 0, 0]} />
        <Box p={[0, -0.44, 0.08]} s={[0.12, 0.1, 0.12]} c={skin} />
      </group>
      {/* head */}
      <group position={[0, 1.42, 0]}>
        <Box p={[0, 0, 0]} s={[0.38, 0.38, 0.36]} c={skin} rough={0.8} />
        <Box p={[0, 0.2, -0.02]} s={[0.41, 0.1, 0.4]} c={hair} />
        <Box p={[0, 0.05, -0.19]} s={[0.41, 0.3, 0.06]} c={hair} />
        <Box p={[-0.2, 0.08, 0]} s={[0.04, 0.2, 0.38]} c={hair} />
        <Box p={[0.2, 0.08, 0]} s={[0.04, 0.2, 0.38]} c={hair} />
        <Box p={[-0.08, 0.02, 0.185]} s={[0.05, 0.06, 0.01]} c="#111" />
        <Box p={[0.08, 0.02, 0.185]} s={[0.05, 0.06, 0.01]} c="#111" />
        <Box p={[0, -0.1, 0.185]} s={[0.12, 0.025, 0.01]} c="#5a2a20" />
        <Box p={[0, -0.15, 0.17]} s={[0.22, 0.06, 0.03]} c="#2a1c16" />
      </group>
    </group>
  );
};

const Bubble: React.FC<{text: string; pos: [number, number, number]; t0: number; t: number; tint: string}> = ({text, pos, t0, t, tint}) => {
  const {c, ctx, tex} = useCanvas(512, 200);
  const {camera} = useThree();
  if (t < t0) return null;
  ctx.clearRect(0, 0, 512, 200);
  ctx.fillStyle = tint; roundRect(ctx, 8, 8, 496, 140, 40); ctx.fill();
  ctx.beginPath(); ctx.moveTo(90, 146); ctx.lineTo(60, 192); ctx.lineTo(140, 146); ctx.fill();
  ctx.fillStyle = '#16121c'; ctx.font = '800 50px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 96);
  tex.needsUpdate = true;
  const s = back((t - t0) / 0.35) * 0.95;
  const q = new THREE.Quaternion(); q.copy(camera.quaternion);
  return (
    <mesh position={[pos[0], pos[1] + Math.sin(t * 2 + pos[0]) * 0.03, pos[2]]} quaternion={q} scale={[s, s, s]}>
      <planeGeometry args={[1.3, 0.51]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
};

// ----------------------------------------------------------------- the film
export const Room: React.FC<RoomProps> = ({lines, total}) => {
  const frame = useCurrentFrame(); const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const starts = [0, ...lines.slice(1).map((l) => l.start - 0.25)];
  let shot = 0; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) shot = k;
  const st = t - starts[shot];
  const floorTex = useMemo(() => { const x = plankTexture('#7a5236', 'rgba(40,20,10,0.6)'); x.repeat.set(3, 3); return x; }, []);
  const wallTex = useMemo(() => { const x = plankTexture('#4a3326', 'rgba(20,10,5,0.7)', true); x.repeat.set(4, 1); return x; }, []);
  const glowUp = shot >= 5 ? easeOut((t - starts[5]) / 0.8) : 0;     // room "comes alive" on the good result
  const turn = shot >= 8 ? back((t - starts[8]) / 0.7) : 0;
  const wave = shot >= 8 ? clamp((t - starts[8] - 0.6) / 0.3) : 0;
  const bubbles: [string, [number, number, number], string][] = [
    ['Secret kya hai?', [-1.5, 1.85, -0.9], '#ffffff'], ['Kaise banaya?', [1.5, 2.05, -1.1], '#ffe08a'],
    ['Editor kaun hai?', [-0.35, 2.4, -1.4], '#a8e6ff'], ['Bhai app batao', [1.2, 1.5, -0.4], '#ffb3c7'], ['Software?', [0.75, 2.6, -1.7], '#c9ffb3'],
  ];
  const caption = lines.find((l) => t >= l.start - 0.05 && t < l.end + 0.35);
  const KEY = new Set(['APP', 'EDITOR', 'SECRET', 'BEKAAR', 'SAHI', 'CODE.', 'FRAME', '15', 'FOUNDER', 'AI,', 'AI']);

  return (
    <AbsoluteFill style={{background: '#08060b'}}>
      <style>{`@font-face{font-family:Poppins;font-weight:800;src:url(${staticFile('Poppins-ExtraBold.ttf')})}
               @font-face{font-family:Poppins;font-weight:900;src:url(${staticFile('Poppins-Black.ttf')})}`}</style>
      <ThreeCanvas width={width} height={height} shadows gl={{toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3}}
        camera={{fov: 38, near: 0.05, far: 60}}>
        <CameraRig t={t} starts={starts} total={total} />
        <color attach="background" args={['#0b0910']} />
        <fog attach="fog" args={['#0b0910', 6, 14]} />
        <hemisphereLight args={['#6f7dff', '#2a1608', 0.45 + 0.15 * glowUp]} />
        {/* soft key on the founder's face when he turns around */}
        <pointLight position={[0.7, 1.7, 0.9]} intensity={shot >= 8 ? 5 : 0.6} distance={4} decay={1.5} color="#ffd2b0" />
        {/* warm desk lamp (key) */}
        <pointLight position={[-1.05, 1.75, -1.35]} intensity={9 + 4 * glowUp} distance={7} decay={1.6} color="#ffb067" castShadow
          shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.002} />
        {/* cool moonlight from the window side (rim) */}
        <directionalLight position={[4, 4, 1]} intensity={0.9} color="#7b8cff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        {/* screen glow */}
        <pointLight position={[0, 1.36, -0.9]} intensity={2.2} distance={2.5} color={shot === 4 ? '#ff6bd5' : '#a9c6ff'} />
        {/* wall art lights up on the good result */}
        <pointLight position={[0.9, 2.2, -1.9]} intensity={3 * glowUp} distance={2} color="#ff4d6d" />
        <pointLight position={[-0.6, 2.3, -1.9]} intensity={3 * glowUp} distance={2} color="#4dc3ff" />

        {/* room */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[14, 14]} /><meshStandardMaterial map={floorTex} roughness={0.85} /></mesh>
        <mesh position={[0, 3, -2.3]} receiveShadow><planeGeometry args={[14, 6]} /><meshStandardMaterial map={wallTex} roughness={0.9} /></mesh>
        <mesh position={[-3.2, 3, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[10, 6]} /><meshStandardMaterial map={wallTex} roughness={0.9} /></mesh>
        {/* rug */}
        <Box p={[0, 0.005, 0.2]} s={[2.6, 0.01, 1.8]} c="#5b2a3c" rough={1} />
        {/* desk */}
        <Box p={[0, 0.84, -1.55]} s={[2.5, 0.07, 1.0]} c="#8b5a3a" rough={0.6} />
        {[-1.15, 1.15].map((x) => [-1.95, -1.15].map((z) => <Box key={`${x}${z}`} p={[x, 0.41, z]} s={[0.07, 0.82, 0.07]} c="#5e3c27" />))}
        {/* retro computer */}
        <Box p={[0, 0.93, -1.6]} s={[0.95, 0.12, 0.72]} c="#d9cfb8" />
        <Box p={[0, 1.36, -1.6]} s={[0.82, 0.66, 0.62]} c="#e6dcc4" rough={0.55} />
        <Box p={[0, 1.36, -1.29]} s={[0.7, 0.54, 0.02]} c="#b9ae96" />
        <Screen t={t} shot={shot} st={st} lines={lines} />
        <Box p={[0, 0.9, -1.05]} s={[0.78, 0.04, 0.26]} c="#ddd3bc" />
        {Array.from({length: 24}).map((_, k) => <Box key={k} p={[-0.33 + (k % 12) * 0.06, 0.93, -1.12 + Math.floor(k / 12) * 0.08]} s={[0.045, 0.02, 0.05]} c="#f1ead8" />)}
        {/* lamp */}
        <Box p={[-1.0, 0.9, -1.75]} s={[0.22, 0.05, 0.22]} c="#222" />
        <Box p={[-1.0, 1.25, -1.75]} s={[0.035, 0.7, 0.035]} c="#222" />
        <mesh position={[-1.02, 1.72, -1.5]} rotation={[0.6, 0, 0]} castShadow><coneGeometry args={[0.2, 0.28, 24, 1, true]} /><meshStandardMaterial color="#1d1d1d" side={THREE.DoubleSide} /></mesh>
        <mesh position={[-1.03, 1.66, -1.42]}><sphereGeometry args={[0.06, 16, 16]} /><meshBasicMaterial color="#ffe0b0" toneMapped={false} /></mesh>
        {/* mug + plant */}
        <mesh position={[0.75, 0.95, -1.3]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.15, 20]} /><meshStandardMaterial color="#e94e3c" /></mesh>
        <mesh position={[1.0, 1.0, -1.85]} castShadow><cylinderGeometry args={[0.13, 0.1, 0.25, 20]} /><meshStandardMaterial color="#b5653d" /></mesh>
        {[[0, 1.25, 0.2], [0.1, 1.32, -0.4], [-0.1, 1.3, 0.6], [0.05, 1.42, 1.2], [-0.06, 1.38, -1.0]].map(([x, y, r], k) =>
          <Box key={k} p={[1.0 + x, y, -1.85]} s={[0.07, 0.38, 0.16]} r={[0.3, r, 0.25]} c={k % 2 ? '#2f8f4e' : '#3fae5f'} />)}
        {/* wall art */}
        <Box p={[0.9, 2.2, -2.27]} s={[0.55, 0.55, 0.04]} c="#e8364f" e="#ff2a4d" ei={0.15 + 0.9 * glowUp} />
        <Box p={[-0.6, 2.35, -2.27]} s={[0.42, 0.62, 0.04]} c="#2aa7e8" e="#2ab6ff" ei={0.15 + 0.9 * glowUp} />
        <Box p={[1.55, 1.8, -2.27]} s={[0.3, 0.3, 0.04]} c="#f5c542" e="#ffcc33" ei={0.1 + 0.8 * glowUp} />
        {/* shelf with books */}
        <Box p={[-1.9, 1.9, -2.15]} s={[1.0, 0.04, 0.26]} c="#5e3c27" />
        {['#d9534f', '#5bc0de', '#f0ad4e', '#5cb85c', '#9b59b6'].map((c2, k) => <Box key={k} p={[-2.3 + k * 0.17, 2.05, -2.15]} s={[0.12, 0.26 + (k % 2) * 0.05, 0.2]} c={c2} />)}
        {/* fairy lights that switch on with the good result */}
        {Array.from({length: 14}).map((_, k) => (
          <mesh key={k} position={[-2.2 + k * 0.33, 2.85 - Math.sin((k / 13) * Math.PI) * 0.18, -2.25]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshBasicMaterial color={['#ffd166', '#ff6b6b', '#4dd4ff'][k % 3]} transparent opacity={0.15 + 0.85 * glowUp * (0.7 + 0.3 * Math.sin(t * 5 + k))} toneMapped={false} />
          </mesh>))}
        {![4, 6, 7].includes(shot) && <Character turn={turn} wave={wave} t={t} />}
        {shot === 2 && bubbles.map(([txt, p, tint], k) => <Bubble key={k} text={txt} pos={p} t0={starts[2] + 0.15 + k * 0.32} t={t} tint={tint} />)}
      </ThreeCanvas>

      {/* captions: word-by-word reveal, upper area like the reference */}
      {caption && (
        <div style={{position: 'absolute', top: 70, width: '100%', textAlign: 'center', fontFamily: 'Poppins', fontWeight: 800,
          fontSize: 64, color: '#fff', textShadow: '0 4px 18px rgba(0,0,0,0.85)', padding: '0 120px', lineHeight: 1.15}}>
          <div style={{display: 'inline-block', background: 'rgba(10,8,14,0.55)', borderRadius: 26, padding: '10px 34px 14px', backdropFilter: 'blur(6px)'}}>
          {caption.text.split(' ').map((w, k, arr) => {
            const ws = caption.start + ((caption.end - caption.start) * k) / arr.length;
            const a = clamp((t - ws) / 0.12);
            const key = KEY.has(w.toUpperCase());
            return <span key={k} style={{opacity: a, display: 'inline-block', transform: `translateY(${(1 - easeOut(a)) * 14}px)`,
              color: key ? '#ffd166' : '#fff', marginRight: 16}}>{w}</span>;
          })}
          </div>
        </div>
      )}
      {/* "CODE." hit and CTA */}
      {shot === 6 && (
        <div style={{position: 'absolute', bottom: 120, width: '100%', textAlign: 'center', fontFamily: 'Poppins', fontWeight: 900,
          fontSize: 190 * (0.8 + 0.2 * back(st / 0.35)), color: '#ffd166', letterSpacing: 6, textShadow: '0 0 40px rgba(255,180,60,0.7)'}}>CODE.</div>
      )}
      {shot === 9 && (
        <div style={{position: 'absolute', bottom: 110, width: '100%', display: 'flex', justifyContent: 'center'}}>
          <div style={{background: '#ff3448', color: '#fff', fontFamily: 'Poppins', fontWeight: 900, fontSize: 72, padding: '18px 54px', borderRadius: 60,
            transform: `scale(${back((t - starts[9] - 0.2) / 0.4)})`, boxShadow: '0 10px 40px rgba(255,52,72,0.6)'}}>COMMENT “AI” 💬</div>
        </div>
      )}
      {/* film vignette */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none'}} />
      {/* fade in from black on the first 0.4 s, like a screen waking up */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - clamp(t / 0.45)}} />
    </AbsoluteFill>
  );
};
