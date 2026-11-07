// Pilot Short (9:16): "बिना camera, बिना GPU — anime video". Story: hook → promise → process →
// problem (lip-sync off) → fix (loudness drives the mouth) → payoff → comment CTA.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, staticFile} from 'remotion';
import {Host, PAL, Pose} from './Host';

type Line = {start: number; dur: number; text: string};
export type PilotProps = {fps: number; total: number; lines: Line[]; mouth: number[]};

const W = 1080, H = 1920;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => Easing.out(Easing.cubic)(clamp(x));
const rnd = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const FONT = "'Poppins', 'Noto Sans Devanagari', sans-serif";

// ---------- room (recurring set) ----------
const Room: React.FC<{t: number}> = ({t}) => (
  <g>
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0B1030" /><stop offset="100%" stopColor="#1E1A4A" />
      </linearGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0A1A4A" /><stop offset="100%" stopColor="#3B2A78" />
      </linearGradient>
      <radialGradient id="bulb"><stop offset="0%" stopColor="#FFD38A" /><stop offset="40%" stopColor="#FF9A3C" stopOpacity={0.6} /><stop offset="100%" stopColor="#FF9A3C" stopOpacity={0} /></radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={PAL.cyan} stopOpacity={0.45} /><stop offset="100%" stopColor={PAL.cyan} stopOpacity={0} /></radialGradient>
    </defs>
    <rect x={-600} y={-400} width={2280} height={2800} fill="url(#wall)" />
    {/* window with night city */}
    <g transform="translate(80,250)">
      <rect x={-14} y={-14} width={448} height={588} rx={10} fill="#2A2350" />
      <rect x={0} y={0} width={420} height={560} fill="url(#sky)" />
      <circle cx={320} cy={110} r={46} fill="#FFF1C9" opacity={0.95} />
      <circle cx={338} cy={98} r={40} fill="#0E1C50" opacity={0.0} />
      {Array.from({length: 40}).map((_, i) => (
        <circle key={i} cx={rnd(i) * 420} cy={rnd(i + 50) * 260} r={1 + rnd(i + 9) * 1.6} fill="#fff" opacity={0.35 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))} />
      ))}
      {Array.from({length: 11}).map((_, i) => {
        const bw = 30 + rnd(i + 3) * 40, bh = 120 + rnd(i + 7) * 220, x = i * 40 - 10;
        return (
          <g key={i}>
            <rect x={x} y={560 - bh} width={bw} height={bh} fill={i % 2 ? '#1A1440' : '#221A52'} />
            {Array.from({length: Math.floor(bh / 26)}).map((__, j) => rnd(i * 31 + j) > 0.55 ? (
              <rect key={j} x={x + 6 + (j % 2) * 12} y={560 - bh + 10 + j * 24} width={7} height={9} fill="#FFC86B" opacity={0.85} />
            ) : null)}
          </g>
        );
      })}
      <rect x={205} y={0} width={10} height={560} fill="#2A2350" />
      <rect x={0} y={275} width={420} height={10} fill="#2A2350" />
    </g>
    {/* fairy lights */}
    <path d="M -40 170 Q 540 330 1120 170" stroke="#3A3166" strokeWidth={3} fill="none" />
    {Array.from({length: 14}).map((_, i) => {
      const u = i / 13, x = -40 + u * 1160, y = 170 + 4 * 160 * u * (1 - u) * 0.98;
      const tw = 0.7 + 0.3 * Math.sin(t * 3 + i * 1.7);
      return <g key={i}><circle cx={x} cy={y + 14} r={38 * tw} fill="url(#bulb)" /><circle cx={x} cy={y + 14} r={7} fill="#FFE2A8" /></g>;
    })}
    {/* shelf with books + plant */}
    <g transform="translate(700,560)">
      <rect x={0} y={150} width={330} height={16} fill="#3A2C5E" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={20 + i * 34} y={150 - (80 + (i % 3) * 18)} width={28} height={80 + (i % 3) * 18} rx={3} fill={[PAL.blue, PAL.saffron, '#7C5CFF', PAL.cyan, '#FF6F91'][i]} opacity={0.85} />)}
      <path d="M 250 150 L 262 100 L 300 100 L 310 150 Z" fill="#C8673A" />
      <path d="M 282 100 C 250 60 240 40 262 20 C 270 50 280 70 284 98 C 290 60 310 40 330 40 C 316 66 300 86 288 100 Z" fill={PAL.green} opacity={0.85} />
    </g>
  </g>
);

const Desk: React.FC = () => (
  <g>
    <rect x={-600} y={1400} width={2280} height={900} fill="#271C45" />
    <rect x={-600} y={1400} width={2280} height={14} fill="#4A3A7A" />
    {/* laptop seen from behind (own spark mark) */}
    <path d="M 290 1120 L 790 1120 L 810 1408 L 270 1408 Z" fill="#C9CEDE" />
    <path d="M 290 1120 L 790 1120 L 796 1160 L 284 1160 Z" fill="#E4E8F4" />
    <path d="M 540 1230 l 12 30 l 30 12 l -30 12 l -12 30 l -12 -30 l -30 -12 l 30 -12 Z" fill={PAL.cyan} opacity={0.9} />
    <rect x={240} y={1404} width={600} height={18} rx={6} fill="#9CA2B8" />
    {/* mug */}
    <rect x={880} y={1300} width={90} height={110} rx={14} fill={PAL.cream} />
    <path d="M 970 1325 C 1010 1325 1010 1385 970 1385" stroke={PAL.cream} strokeWidth={14} fill="none" />
  </g>
);

// ---------- camera shots ----------
type Shot = {from: number; s: number; fx: number; fy: number; sy: number; pan: number};
const HEAD = {x: 540, y: 820};

const Caption: React.FC<{t: number; lines: Line[]}> = ({t, lines}) => {
  const l = lines.find((x) => t >= x.start - 0.05 && t < x.start + x.dur + 0.25);
  if (!l) return null;
  const words = l.text.split(' ');
  const chunks: string[][] = []; let cur: string[] = []; let len = 0;
  for (const w of words) { if (cur.length && (cur.length >= 4 || len + w.length > 20)) { chunks.push(cur); cur = []; len = 0; } cur.push(w); len += w.length + 1; }
  if (cur.length) chunks.push(cur);
  const total = words.reduce((a, w) => a + w.length + 2, 0);
  let acc = 0; const wt: number[] = [];
  for (const w of words) { wt.push(l.start + (acc / total) * l.dur); acc += w.length + 2; }
  let wi = 0; let ci = 0;
  for (let k = 0; k < words.length; k++) if (t >= wt[k]) wi = k;
  let n = 0; for (let c = 0; c < chunks.length; c++) { if (wi < n + chunks[c].length) { ci = c; break; } n += chunks[c].length; }
  const chunk = chunks[ci], base = chunks.slice(0, ci).reduce((a, c) => a + c.length, 0);
  const pop = ease((t - wt[base]) / 0.12);
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: 1440, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 18px',
      transform: `translateY(${(1 - pop) * 16}px)`, opacity: pop}}>
      {chunk.map((w, k) => {
        const on = base + k === wi;
        return <span key={k} style={{fontFamily: FONT, fontWeight: 800, fontSize: 74, lineHeight: 1.25, color: on ? PAL.saffron : '#fff',
          WebkitTextStroke: '10px #0B0E24', paintOrder: 'stroke fill', textShadow: '0 6px 0 rgba(0,0,0,.35)'}}>{w}</span>;
      })}
    </div>
  );
};

const Panel: React.FC<{children: React.ReactNode; k: number}> = ({children, k}) => (
  <div style={{position: 'absolute', left: 70, right: 70, top: 150, height: 640, borderRadius: 34, background: 'rgba(10,14,40,.94)',
    border: `3px solid ${PAL.cyan}55`, boxShadow: `0 0 60px ${PAL.cyan}33`, transform: `translateY(${(1 - k) * -60}px) scale(${0.96 + 0.04 * k})`, opacity: k, overflow: 'hidden'}}>
    <div style={{display: 'flex', gap: 12, padding: '22px 28px'}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />)}</div>
    {children}
  </div>
);

const Typed: React.FC<{text: string; t: number; t0: number; cps?: number; color?: string; size?: number}> = ({text, t, t0, cps = 28, color = '#DDE6FF', size = 40}) => {
  const n = Math.max(0, Math.floor((t - t0) * cps)); if (n <= 0) return null;
  const chars = Array.from(text);
  return <div style={{fontFamily: "'DejaVu Sans Mono', 'Noto Sans Devanagari', monospace", fontSize: size, color, padding: '6px 40px', whiteSpace: 'pre-wrap'}}>{chars.slice(0, n).join('')}{n < chars.length && Math.floor(t * 4) % 2 ? '▍' : ''}</div>;
};

export const Pilot: React.FC<PilotProps> = ({fps, lines, mouth}) => {
  const f = useCurrentFrame();
  const t = f / fps;
  const L = lines.map((l) => l.start);
  const S: Shot[] = [
    {from: 0, s: 2.05, fx: HEAD.x, fy: HEAD.y + 10, sy: 700, pan: -12},     // 1 hook close-up
    {from: 3.05, s: 1.0, fx: 540, fy: 900, sy: 900, pan: 18},               // 1b reveal: whole room
    {from: L[1] - 0.15, s: 1.3, fx: HEAD.x, fy: HEAD.y + 120, sy: 820, pan: -14}, // 2 promise medium
    {from: L[2] - 0.15, s: 1.05, fx: HEAD.x, fy: HEAD.y + 120, sy: 1150, pan: 10}, // 3 process (panel on top)
    {from: L[3] - 0.15, s: 2.1, fx: HEAD.x, fy: HEAD.y + 10, sy: 720, pan: 10},     // 4 problem close-up
    {from: L[4] - 0.15, s: 1.05, fx: HEAD.x, fy: HEAD.y + 120, sy: 1150, pan: -10}, // 5 fix (graph panel)
    {from: L[5] - 0.15, s: 0.92, fx: 540, fy: 880, sy: 860, pan: 14},               // 6 payoff wide
    {from: L[6] - 0.15, s: 1.25, fx: HEAD.x + 120, fy: HEAD.y + 140, sy: 840, pan: -12}, // 7 CTA medium
  ];
  let si = 0; for (let i = 0; i < S.length; i++) if (t >= S[i].from) si = i;
  const sh = S[si], next = S[si + 1]?.from ?? 40;
  const u = clamp((t - sh.from) / (next - sh.from));
  const panX = sh.pan * (Easing.inOut(Easing.sin)(u) - 0.5) * 2;
  const sinceCut = t - sh.from;

  // performance
  const mi = Math.min(mouth.length - 1, Math.max(0, si === 4 ? f + 9 : f)); // shot 4: deliberately late mouth (the "bug")
  let m = mouth[mi] ?? 0;
  if (si === 4 && t > L[3] + 3.2) m = mouth[f] ?? 0;                     // …until the fix starts landing
  const bl = [1.6, 4.4, 7.9, 11.2, 12.9, 16.4, 20.6, 24.9, 28.2, 31.5, 33.9];
  const blink = Math.max(0, ...bl.map((b) => 1 - Math.abs(t - b) / 0.07));
  const expr: Partial<Pose>[] = [
    {brow: 0.7, smile: 0.35}, {brow: 0.5, smile: 0.6}, {brow: 0.4, smile: 0.75},
    {brow: 0.2, smile: 0.5, lookY: -0.9}, {brow: -1, smile: 0}, {brow: 0.3, smile: 0.5, lookY: -0.8, lookX: 0.2},
    {brow: 0.6, smile: 1}, {brow: 0.5, smile: 0.85, lookX: 0.5},
  ];
  const e = expr[si];
  const pose: Pose = {
    mouth: m, blink, brow: e.brow ?? 0, smile: e.smile ?? 0.4, lookX: e.lookX ?? 0, lookY: e.lookY ?? 0,
    tilt: Math.sin(t * 1.3) * 2.2 + (m - 0.3) * 2 + (si === 4 ? -4 : 0) + (si === 6 ? 3 : 0),
    arm: si === 7 ? ease((t - S[7].from - 0.3) / 0.5) : 0, rim: si === 4 ? 0.2 : 0.7,
  };
  const bob = Math.sin(t * 2.1) * 4 + m * 3;
  const glitch = si === 4 && t < L[3] + 3.2 && rnd(Math.floor(f / 2)) > 0.72;
  const jx = glitch ? (rnd(f) - 0.5) * 18 : 0;

  const cam = `translate(${W / 2 + panX + jx},${sh.sy}) scale(${sh.s}) translate(${-sh.fx},${-sh.fy})`;
  const panelK = (si === 3 || si === 5) ? ease(sinceCut / 0.4) : 0;
  const wipe = clamp(1 - sinceCut / 0.18);

  return (
    <AbsoluteFill style={{background: PAL.navy}}>
      <style>{`@font-face{font-family:'Poppins';src:url(${staticFile('Poppins-ExtraBold.ttf')});font-weight:800}
      @font-face{font-family:'Poppins';src:url(${staticFile('Poppins-Black.ttf')});font-weight:900}`}</style>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute'}}>
        <g transform={cam}>
          <g transform={`translate(${-panX * 0.4},0)`}><Room t={t} /></g>
          <ellipse cx={540} cy={1180} rx={520} ry={420} fill="url(#glow)" opacity={si === 4 ? 0.25 : 0.7} />
          <g transform={`translate(${HEAD.x},${HEAD.y + bob})`}><Host {...pose} /></g>
          {sh.s < 1.8 && <Desk />}
        </g>
        {glitch && [0, 1, 2].map((k) => (
          <rect key={k} x={0} y={300 + rnd(f * 3 + k) * 900} width={W} height={10 + rnd(f + k) * 40} fill={k % 2 ? PAL.red : PAL.cyan} opacity={0.35} style={{mixBlendMode: 'screen'}} />
        ))}
        <rect width={W} height={H} fill="url(#vig)" />
        <defs><radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.55} /></radialGradient></defs>
      </svg>

      {/* shot 1: chip */}
      {si <= 1 && <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', opacity: ease((t - 0.2) / 0.3)}}>
        <span style={{fontFamily: FONT, fontWeight: 800, fontSize: 38, color: PAL.navy, background: PAL.cyan, padding: '10px 26px', borderRadius: 40}}>AI EXPERIMENT #0</span>
      </div>}

      {/* shot 2: what we'll see */}
      {si === 2 && <div style={{position: 'absolute', top: 200, width: '100%', display: 'flex', justifyContent: 'center', gap: 26}}>
        {[['📝', 'Script'], ['🎙️', 'Voice'], ['🎞️', 'Animation']].map(([ic, lb], k) => {
          const kk = ease((t - S[2].from - 0.25 - k * 0.35) / 0.35);
          return <div key={lb} style={{opacity: kk, transform: `translateY(${(1 - kk) * 40}px)`, background: 'rgba(10,14,40,.85)', border: `3px solid ${PAL.saffron}`, borderRadius: 28, padding: '18px 26px', textAlign: 'center'}}>
            <div style={{fontSize: 64}}>{ic}</div><div style={{fontFamily: FONT, fontWeight: 800, fontSize: 36, color: '#fff'}}>{lb}</div></div>;
        })}
      </div>}

      {/* shot 3: the process, typed in a terminal */}
      {si === 3 && <Panel k={panelK}>
        <Typed t={t} t0={S[3].from + 0.3} text={'> claude: एक 30 sec का script लिखो'} />
        {t > S[3].from + 1.5 && <Typed t={t} t0={S[3].from + 1.5} cps={60} color={PAL.green} text={'✓ script.txt  (7 lines)'} />}
        {t > S[3].from + 2.0 && <Typed t={t} t0={S[3].from + 2.0} text={'> tts --voice hm_omega --lang hi'} />}
        {t > S[3].from + 2.9 && <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '18px 40px', height: 120}}>
          {Array.from({length: 34}).map((_, k) => <div key={k} style={{width: 14, borderRadius: 7, background: PAL.cyan,
            height: 10 + 90 * Math.abs(Math.sin(k * 0.7 + t * 9)) * ease((t - S[3].from - 2.9 - k * 0.02) / 0.2)}} />)}
        </div>}
        {t > S[3].from + 3.5 && <Typed t={t} t0={S[3].from + 3.5} cps={60} color={PAL.green} text={'✓ voice.wav'} />}
      </Panel>}

      {/* shot 4: the bug */}
      {si === 4 && <div style={{position: 'absolute', top: 130, width: '100%', textAlign: 'center'}}>
        {t < L[3] + 3.2
          ? <span style={{fontFamily: FONT, fontWeight: 900, fontSize: 52, color: '#fff', background: PAL.red, padding: '12px 30px', borderRadius: 18, opacity: ease((t - S[4].from - 0.2) / 0.2)}}>✗ LIP-SYNC OFF</span>
          : <span style={{fontFamily: FONT, fontWeight: 900, fontSize: 52, color: PAL.navy, background: '#FFD166', padding: '12px 30px', borderRadius: 18}}>🤔 FIX?</span>}
      </div>}

      {/* shot 5: loudness drives the mouth */}
      {si === 5 && <Panel k={panelK}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 40, color: '#fff', padding: '0 40px'}}>Voice loudness → <span style={{color: PAL.saffron}}>mouth</span></div>
        <svg width={940} height={330} style={{marginTop: 10}}>
          <line x1={470} y1={10} x2={470} y2={300} stroke={PAL.saffron} strokeWidth={4} />
          <polyline fill="none" stroke={PAL.cyan} strokeWidth={6} strokeLinejoin="round"
            points={Array.from({length: 95}).map((_, k) => { const fr = f - 47 + k; const v = mouth[Math.max(0, Math.min(mouth.length - 1, fr))] ?? 0; return `${k * 10},${280 - v * 240}`; }).join(' ')} />
          <circle cx={470} cy={280 - (mouth[f] ?? 0) * 240} r={14} fill={PAL.saffron} />
        </svg>
        <div style={{position: 'absolute', right: 40, bottom: 30, fontFamily: FONT, fontWeight: 800, fontSize: 40, color: PAL.green, opacity: ease((t - S[5].from - 2.2) / 0.3)}}>✓ synced</div>
      </Panel>}

      {/* shot 6: payoff */}
      {si === 6 && <>
        {Array.from({length: 16}).map((_, k) => { const a = rnd(k) * Math.PI * 2, r = 260 + rnd(k + 4) * 260, kk = ease((t - S[6].from - rnd(k + 8) * 0.6) / 0.6);
          return <div key={k} style={{position: 'absolute', left: 540 + Math.cos(a) * r * kk - 20, top: 760 + Math.sin(a) * r * kk - 20, fontSize: 42, opacity: kk * (1 - clamp((t - S[6].from - 2.2) / 0.8))}}>✨</div>; })}
        <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', transform: `scale(${0.6 + 0.4 * Easing.out(Easing.back(2))(clamp((t - S[6].from - 0.2) / 0.4))})`, opacity: ease((t - S[6].from - 0.2) / 0.2)}}>
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: 96, color: PAL.saffron, WebkitTextStroke: '12px #0B0E24', paintOrder: 'stroke fill'}}>RESULT ✓</span>
        </div>
      </>}

      {/* shot 7: comment card (pointing) */}
      {si === 7 && (() => { const kk = ease((t - S[7].from - 0.6) / 0.4); const typed = 'मुझे AI से… बनवाना है'; const n = Math.max(0, Math.floor((t - S[7].from - 1.4) * 14));
        return <div style={{position: 'absolute', left: 90, top: 180, width: 560, opacity: kk, transform: `translateY(${(1 - kk) * 30}px)`, background: '#fff', borderRadius: 30, padding: '26px 30px', boxShadow: '0 20px 50px rgba(0,0,0,.4)'}}>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 34, color: '#555'}}>💬 Comment</div>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 44, color: '#111', marginTop: 10, minHeight: 60}}>{Array.from(typed).slice(0, n).join('')}<span style={{opacity: Math.floor(t * 3) % 2}}>|</span></div>
        </div>; })()}

      <Caption t={t} lines={lines} />
      {wipe > 0 && si > 0 && <div style={{position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent ${-40 + (1 - wipe) * 140}%, ${PAL.cyan}88 ${-20 + (1 - wipe) * 140}%, transparent ${(1 - wipe) * 140}%)`}} />}
      <AbsoluteFill style={{background: '#000', opacity: clamp(1 - t / 0.35)}} />
    </AbsoluteFill>
  );
};
