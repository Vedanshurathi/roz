// Glass UI kit for EP001: fonts, frosted-glass panels, pop-in/out animation, captions with word highlight, particles.
import React from 'react';
import {continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const C = {saffron: '#FF9F1C', cyan: '#2EE6FF', gold: '#FFD166', pink: '#FF4D8D', red: '#FF3B47', green: '#3DFFA2', white: '#FFFFFF', ink: '#0B0D18'};
export const F = {
  head: "'PoppinsBlack', 'DevaBold', sans-serif",
  bold: "'PoppinsXB', 'DevaBold', sans-serif",
  deva: "'DevaBold', 'PoppinsXB', sans-serif",
  body: "'DevaReg', 'PoppinsXB', sans-serif",
};

const fontHandle = delayRender('ep1 fonts');
Promise.all(([
  ['PoppinsBlack', 'Poppins-Black.ttf'], ['PoppinsXB', 'Poppins-ExtraBold.ttf'],
  ['DevaBold', 'ep1/NotoSansDevanagari-Bold.ttf'], ['DevaReg', 'ep1/NotoSansDevanagari-Regular.ttf'],
] as const).map(([fam, file]) => new FontFace(fam, `url(${staticFile(file)})`).load().then((f) => { (document.fonts as any).add(f); })))
  .then(() => continueRender(fontHandle)).catch((e) => { console.error(e); continueRender(fontHandle); });

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

export const useT = () => { const f = useCurrentFrame(); const {fps} = useVideoConfig(); return {frame: f, fps, t: f / fps}; };

/** Frosted glass panel. Keep opacity at 1 when at rest: an ancestor with opacity < 1 cuts the backdrop blur. */
export const Glass: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; tint?: string; radius?: number; sheen?: number; border?: string}> = (
  {style, children, tint = '255,255,255', radius = 28, sheen = -1, border = 'rgba(255,255,255,0.32)'}) => (
  <div style={{
    position: 'relative', borderRadius: radius, overflow: 'hidden',
    background: `linear-gradient(140deg, rgba(${tint},0.22) 0%, rgba(${tint},0.07) 52%, rgba(${tint},0.12) 100%)`,
    backdropFilter: 'blur(26px) saturate(175%) brightness(0.82)', WebkitBackdropFilter: 'blur(26px) saturate(175%) brightness(0.82)',
    border: `1.5px solid ${border}`,
    boxShadow: '0 26px 70px rgba(0,0,0,0.42), inset 0 1.5px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(255,255,255,0.1)',
    ...style,
  }}>
    <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 38%)', pointerEvents: 'none'}} />
    {sheen >= 0 && sheen <= 1 && (
      <div style={{position: 'absolute', top: -40, bottom: -40, width: 140, left: `${-30 + sheen * 140}%`, transform: 'skewX(-20deg)',
        background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)', pointerEvents: 'none'}} />
    )}
    <div style={{position: 'relative'}}>{children}</div>
  </div>
);

/** Positioned element that springs in at t0 and eases out at t1. */
export const Pop: React.FC<{t0: number; t1: number; dir?: 'l' | 'r' | 'u' | 'd' | 's'; style?: React.CSSProperties; children: (k: {s: number; lt: number; sheen: number}) => React.ReactNode}> = (
  {t0, t1, dir = 'u', style, children}) => {
  const {frame, fps, t} = useT();
  if (t < t0 || t >= t1) return null;
  const s = spring({frame: frame - Math.round(t0 * fps), fps, config: {damping: 15, mass: 0.75, stiffness: 150}});
  const out = interpolate(t, [t1 - 0.3, t1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const d = 1 - Math.min(1, s);
  const off = {l: [-90, 0], r: [90, 0], u: [0, 60], d: [0, -60], s: [0, 0]}[dir];
  const sc = (dir === 's' ? 0.6 + 0.4 * s : 0.92 + 0.08 * s) * (0.96 + 0.04 * out);
  const op = Math.min(1, s * 1.6) * out;
  return (
    <div style={{position: 'absolute', opacity: op >= 0.999 ? 1 : op,
      transform: `translate(${off[0] * d}px, ${off[1] * d - (1 - out) * 16}px) scale(${sc})`, ...style}}>
      {children({s, lt: t - t0, sheen: ramp(t, t0 + 0.15, t0 + 0.95)})}
    </div>
  );
};

/** Captions: phrase groups (punctuation or 6 words), the spoken word lights up saffron. */
export type Word = {w: string; t0: number; t1: number};
export const Captions: React.FC<{words: Word[]; end: number; bottom?: number; size?: number; maxW?: number; perGroup?: number}> = ({words, end, bottom = 58, size = 50, maxW = 1380, perGroup = 6}) => {
  const {t} = useT();
  if (!words.length || t < words[0].t0 - 0.15 || t > end + 0.25) return null;
  const groups: Word[][] = []; let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[?।,—…!.:;]$/.test(w.w) || cur.length >= perGroup) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  // merge tiny groups (one short word) into the next one
  const merged: Word[][] = [];
  for (const g of groups) {
    const last = merged[merged.length - 1];
    if (last && last.length <= 1 && last.length + g.length <= 7) last.push(...g); else merged.push([...g]);
  }
  let gi = 0;
  for (let i = 0; i < merged.length; i++) if (t >= merged[i][0].t0 - 0.12) gi = i;
  const g = merged[gi];
  const gIn = ramp(t, g[0].t0 - 0.12, g[0].t0 + 0.05);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', pointerEvents: 'none'}}>
      <div style={{maxWidth: maxW, padding: '12px 34px 16px', borderRadius: 26, background: 'rgba(8,10,22,0.55)',
        backdropFilter: 'blur(16px) saturate(150%)', WebkitBackdropFilter: 'blur(16px) saturate(150%)', border: '1.5px solid rgba(255,255,255,0.18)',
        boxShadow: '0 14px 40px rgba(0,0,0,0.35)', textAlign: 'center', transform: `translateY(${(1 - ease(gIn)) * 14}px)`}}>
        {g.map((w, i) => {
          const on = t >= w.t0 - 0.03 && (t < w.t1 + 0.05 || (i === g.length - 1 && t <= end + 0.25));
          const past = t >= w.t1;
          const pop = on ? 1 + 0.08 * (1 - ramp(t, w.t0, w.t0 + 0.18)) : 1;
          const latin = /^[A-Za-z0-9₹%.,?!:;'"()\-–—]+$/.test(w.w);
          return (
            <span key={i} style={{display: 'inline-block', margin: '0 9px', fontFamily: latin ? F.bold : F.deva, fontSize: size, lineHeight: 1.35,
              color: on ? C.saffron : '#fff', opacity: on || past ? 1 : 0.6, transform: `scale(${pop})`,
              textShadow: on ? '0 0 22px rgba(255,159,28,0.55), 0 3px 10px rgba(0,0,0,0.6)' : '0 3px 10px rgba(0,0,0,0.6)'}}>{w.w}</span>
          );
        })}
      </div>
    </div>
  );
};

// deterministic random
export const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };

/** Firework / sparkle bursts drawn as glowing dots. */
export const Bursts: React.FC<{bursts: {at: number; x: number; y: number; color?: string; n?: number; r?: number}[]}> = ({bursts}) => {
  const {t} = useT();
  const dots: React.ReactNode[] = [];
  bursts.forEach((b, bi) => {
    const lt = t - b.at; if (lt < 0 || lt > 1.9) return;
    const R = rng(bi * 977 + 13); const n = b.n ?? 46; const pal = [C.gold, C.saffron, C.pink, C.cyan, '#fff'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.2, sp = (b.r ?? 300) * (0.55 + 0.45 * R());
      const k = ease(Math.min(1, lt / 1.1));
      const x = b.x + Math.cos(a) * sp * k, y = b.y + Math.sin(a) * sp * k + 70 * lt * lt;
      const op = clamp01(1.2 - lt / 1.6) * (0.75 + 0.25 * Math.sin(lt * 30 + i));
      const col = b.color ?? pal[i % pal.length]; const sz = 6 + 4 * R();
      dots.push(<div key={`${bi}-${i}`} style={{position: 'absolute', left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, borderRadius: '50%',
        background: col, opacity: op, boxShadow: `0 0 14px 4px ${col}`}} />);
    }
  });
  return <>{dots}</>;
};

/** Slow drifting twinkles (title / end card). */
export const Twinkles: React.FC<{n?: number; seed?: number; opacity?: number}> = ({n = 70, seed = 3, opacity = 1}) => {
  const {t} = useT(); const R = rng(seed);
  return (
    <>
      {Array.from({length: n}).map((_, i) => {
        const x = R() * 1920, y0 = R() * 1080, ph = R() * 6.28, sz = 3 + R() * 6, sp = 8 + R() * 18;
        const y = ((y0 - t * sp) % 1080 + 1080) % 1080; const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + ph));
        const col = i % 3 === 0 ? C.saffron : i % 3 === 1 ? C.gold : '#fff';
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: sz, height: sz, borderRadius: '50%', background: col,
          opacity: tw * opacity, boxShadow: `0 0 12px 3px ${col}`}} />;
      })}
    </>
  );
};

export const Chip: React.FC<{children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties}> = ({children, color = C.cyan, size = 22, style}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, fontFamily: F.bold, fontSize: size,
    letterSpacing: 1.5, color, background: 'rgba(255,255,255,0.10)', border: `1.5px solid ${color}66`, ...style}}>{children}</div>
);
