// EP001 — "Diwali Sunday": Avir in his studio. Cycles background plate + three.js Avir + Cycles foreground plate,
// graded together, with the glass UI, captions and the final mix on top.
import React from 'react';
import {AbsoluteFill, Audio, Img, getInputProps, staticFile} from 'remotion';
const IP = getInputProps() as any;
const LAYERS = String(IP.layers ?? 'all');
const CW = Math.round(1920 * (IP.cscale ?? 1)), CH = Math.round(1080 * (IP.cscale ?? 1));
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights, ONE_SHOT, Seg} from './Avir';
import {Bursts, C, Captions, Chip, F, Glass, Pop, Twinkles, clamp01, ease, ramp, rng, useT} from './ui';
import DATA from './data.json';
import MORPH from './morph.json';
import CAMS from './cams.json';

type Line = (typeof DATA.lines)[number];
const L = DATA.lines as Line[];
export const EP1_TOTAL = DATA.total;
const st = (i: number) => L[i].start;
const en = (i: number) => L[i].start + L[i].dur;
const wt = (i: number, sub: string, nth = 0) => L[i].words.filter((w) => w.w.toLowerCase().includes(sub.toLowerCase()))[nth]?.t0 ?? L[i].start;
const TITLE0 = en(2) + 0.25, TITLE1 = st(3) - 0.1;
const CHAPTERS = [
  {n: 'INTRO', t0: 0, t1: st(12) - 1.6},
  {n: 'AI NEWS', t0: st(12) - 1.6, t1: st(22) - 1.3},
  {n: 'FOUNDER LIFE', t0: st(22) - 1.3, t1: st(32) - 1.3},
  {n: 'STARTUP', t0: st(32) - 1.3, t1: st(37) - 0.3},
  {n: 'OUTRO', t0: st(37) - 0.3, t1: DATA.total},
];

// ---------- shots ----------
const lineAt = (t: number) => { let k = -1; for (let i = 0; i < L.length; i++) if (t >= L[i].start - 0.12) k = i; return k; };
const shotAt = (t: number) => {
  if (t >= TITLE0 && t < TITLE1) return 'medium';
  const k = Math.max(0, lineAt(t)); return L[k].shot as keyof typeof CAMS;
};
const runStart = (t: number) => { let k = Math.max(0, lineAt(t)); while (k > 0 && L[k - 1].shot === L[k].shot) k--; return k === 0 ? 0 : L[k].start - 0.12; };
const runEnd = (t: number) => { let k = Math.max(0, lineAt(t)); while (k < L.length - 1 && L[k + 1].shot === L[k].shot) k++; return k === L.length - 1 ? DATA.total : L[k + 1].start - 0.12; };
const ORIGIN: Record<string, string> = {close: '50% 40%', medium: '50% 30%', side: '54% 38%', wide: '50% 60%'};

const PUNCH = [
  {a: wt(4, 'wifi'), b: en(4), z: 0.06},
  {a: st(23) - 0.12, b: en(23), z: 0.08},
  {a: wt(29, 'देखा'), b: en(29), z: 0.1},
  {a: st(33) - 0.12, b: en(33), z: 0.06},
];
const STAMPS = DATA.cue.classified as number[];
const zoomAt = (t: number) => {
  const shot = shotAt(t); let z = 1;
  if (shot === 'close' && !(t >= TITLE0 && t < TITLE1)) z += 0.035 * ease((t - runStart(t)) / Math.max(1, runEnd(t) - runStart(t)));
  for (const p of PUNCH) z += p.z * ease(ramp(t, p.a, p.a + 0.18)) * (1 - ease(ramp(t, p.b, p.b + 0.3)));
  for (const s of STAMPS) if (t >= s && t < s + 0.5) z += 0.035 * Math.exp(-(t - s) * 9);
  return z;
};
const shakeAt = (t: number) => { let x = 0, y = 0; for (const s of STAMPS) if (t >= s && t < s + 0.3) { const e = Math.exp(-(t - s) * 14); x += 9 * e * Math.sin(t * 95); y += 6 * e * Math.cos(t * 81); } return [x, y]; };

// ---------- body + face ----------
const DURS: Record<string, number> = {SitIdle: 8, SitNamaste: 4, SitPoint: 4, SitSecret: 5, SitTalkBoth: 6, SitTalkRight: 6, SitWave: 4};
const SEGS: Seg[] = (() => {
  const out: Seg[] = [{clip: 'SitIdle', start: -10}];
  L.forEach((l, i) => {
    const s = l.start - 0.3, last = out[out.length - 1];
    if (l.clip === last.clip && !ONE_SHOT.has(l.clip)) return;
    out.push({clip: l.clip, start: s});
    if (ONE_SHOT.has(l.clip)) {
      const back = s + DURS[l.clip] - 0.6, next = i + 1 < L.length ? L[i + 1].start - 0.3 : 1e9;
      if (back < next - 0.4) out.push({clip: l.start + l.dur > back + 1.2 ? 'SitTalkRight' : 'SitIdle', start: back});
    }
  });
  return out;
})();
const MOOD: Record<number, [number, number, number]> = {   // line: [smile, browUp, browDown]
  0: [0.04, 0, 0.15], 1: [0.1, 0.05, 0], 2: [0.22, 0.15, 0], 3: [0.55, 0.15, 0], 4: [0.45, 0.1, 0], 5: [0.42, 0.1, 0], 6: [0.2, 0.05, 0],
  7: [0.32, 0.05, 0], 12: [0.3, 0.1, 0], 19: [0.2, 0.15, 0], 22: [0.04, 0, 0.12], 23: [0.0, 0, 0.18], 25: [0.06, 0.12, 0], 29: [0.6, 0.2, 0],
  31: [0.35, 0, 0], 32: [0.22, 0.25, 0], 33: [0.35, 0.1, 0], 34: [0.3, 0.2, 0], 36: [0.4, 0.1, 0], 37: [0.42, 0, 0], 38: [0.55, 0.1, 0], 39: [0.5, 0.05, 0],
};
const moodOf = (i: number): [number, number, number] => MOOD[i] ?? [0.14, 0, 0];
const BLINKS = (() => { const R = rng(41); const b: number[] = []; let x = 1.3; while (x < DATA.total) { b.push(x); if (R() < 0.18) b.push(x + 0.32); x += 2.3 + R() * 3.0; } return b; })();
const SACC = (() => { const R = rng(7); const s: {t: number; x: number; y: number}[] = [{t: 0, x: 0, y: 0}]; let x = 0.8; while (x < DATA.total) { s.push({t: x, x: (R() - 0.5) * 0.24, y: (R() - 0.5) * 0.12}); x += 0.9 + R() * 1.8; } return s; })();
const MORPHS = MORPH as Record<string, number>[];

const faceAt = (t: number, frame: number) => {
  const f: Record<string, number> = {...(MORPHS[frame] ?? {})};
  const add = (k: string, v: number) => { f[k] = Math.min(1, (f[k] ?? 0) + v); };
  const k = Math.max(0, lineAt(t)); const w = k > 0 ? ease(ramp(t, L[k].start - 0.4, L[k].start + 0.2)) : 1;
  const m0 = moodOf(Math.max(0, k - 1)), m1 = moodOf(k); const m = m1.map((v, i) => v * w + m0[i] * (1 - w));
  const jaw = f.jawOpen ?? 0;
  const smile = m[0] * (1 - 0.55 * jaw);
  add('mouthSmileLeft', smile); add('mouthSmileRight', smile); add('cheekSquintLeft', smile * 0.45); add('cheekSquintRight', smile * 0.45);
  add('eyeSquintLeft', smile * 0.25); add('eyeSquintRight', smile * 0.25);
  const lineKick = k >= 0 && t > L[k].start ? 0.22 * Math.exp(-(t - L[k].start) / 0.6) : 0;
  add('browInnerUp', m[1] + lineKick); add('browOuterUpLeft', m[1] * 0.7 + lineKick * 0.6); add('browOuterUpRight', m[1] * 0.7 + lineKick * 0.6);
  add('browDownLeft', m[2]); add('browDownRight', m[2]);
  let bl = 0; for (const b of BLINKS) { const x = (t - b) / 0.17; if (x >= 0 && x < 1) bl = Math.max(bl, Math.sin(Math.PI * Math.pow(x, 0.7))); }
  add('eyeBlinkLeft', bl); add('eyeBlinkRight', bl);
  let si = 0; for (let i = 0; i < SACC.length; i++) if (SACC[i].t <= t) si = i;
  const a = SACC[Math.max(0, si - 1)], b = SACC[si], q = ease(ramp(t, b.t, b.t + 0.07));
  const gx = a.x + (b.x - a.x) * q, gy = a.y + (b.y - a.y) * q;
  if (gx > 0) { add('eyeLookOutLeft', gx); add('eyeLookInRight', gx); } else { add('eyeLookInLeft', -gx); add('eyeLookOutRight', -gx); }
  if (gy > 0) { add('eyeLookUpLeft', gy); add('eyeLookUpRight', gy); } else { add('eyeLookDownLeft', -gy); add('eyeLookDownRight', -gy); }
  let nod = 0; for (let j = 0; j < 6; j++) nod += (MORPHS[frame - j]?.jawOpen ?? 0) / 6;
  return {face: f, nod};
};

// ---------- grade ----------
const NIGHT0 = wt(25, 'रात'), NIGHT1 = wt(25, 'सुबह');
const gradeAt = (t: number) => {
  const title = ramp(t, TITLE0, TITLE0 + 0.3) * (1 - ramp(t, TITLE1 - 0.25, TITLE1));
  const chap = Math.max(...[st(12), st(22), st(32)].map((s, i) => { const a = [en(11), en(21), en(31)][i] + 0.05; return ramp(t, a, a + 0.25) * (1 - ramp(t, s - 0.05, s + 0.3)); }));
  const endc = ramp(t, en(39) + 0.1, en(39) + 0.6);
  const night = ramp(t, NIGHT0 - 0.1, NIGHT0 + 0.3) * (1 - ramp(t, NIGHT1, NIGHT1 + 0.6));
  const secret = ramp(t, st(32) - 0.4, st(32)) * (1 - ramp(t, en(34), en(34) + 0.6));
  const blur = Math.max(title * 16, chap * 12, endc * 14);
  const bright = 1 - 0.38 * Math.max(title, chap, endc) - 0.2 * night - 0.1 * secret;
  return {filter: `contrast(${1.07 + 0.08 * secret}) saturate(${1.14 - 0.25 * night - 0.3 * secret}) brightness(${bright}) hue-rotate(${-10 * night}deg)${blur > 0.3 ? ` blur(${blur}px)` : ''}`,
    night, secret};
};

// ---------- overlays ----------
const W = 1920;
const sideOf = (i: number) => (L[i].shot === 'side' ? 'left' : 'right');
const cardPos = (i: number, w: number, top = 150): React.CSSProperties => (sideOf(i) === 'left' ? {left: 80, top, width: w} : {left: W - 80 - w, top, width: w});

const NEWS = [
  {lines: [13, 14], org: 'OPENAI · CHATGPT', title: 'Images 2.6', date: '4 NOV 2026', src: 'The Next Web · Decrypt · MySmartPrice',
    pts: [{t: () => wt(13, 'line'), x: '✍️  एक line लिखो → animated GIF'}, {t: () => wt(14, '50%'), x: '⚡  ~50% faster images*'}, {t: () => wt(14, 'धीरे'), x: '🔄  धीरे-धीरे सबके लिए rollout'}],
    note: '* OpenAI का दावा'},
  {lines: [15, 16], org: 'GOOGLE · GEMINI', title: 'Omni 1.2 Flash', date: '5 NOV 2026', src: 'ai-tldr · xenospectrum · runtimewire',
    pts: [{t: () => wt(16, '15'), x: '🎬  15 sec तक के video clips'}, {t: () => wt(16, '30%'), x: '💸  v1.1 से ~30% सस्ता (reported)'}, {t: () => wt(16, 'paid'), x: '🧑‍💻  Developers के लिए paid API'}], note: ''},
  {lines: [17, 18], org: 'ANTHROPIC · CLAUDE', title: 'Personal Finance (beta)', date: '5 NOV 2026', src: 'MacRumors · 9to5Mac · BleepingComputer',
    pts: [{t: () => wt(18, 'read-only'), x: '🏦  Bank accounts — read-only'}, {t: () => wt(18, 'ख़र्चों'), x: '📊  ख़र्चों को समझाता है'}, {t: () => wt(18, 'America'), x: '🇺🇸  सिर्फ़ US · paid plans · beta'}], note: ''},
  {lines: [19, 20, 21], org: 'INDIAAI · GOVT. OF INDIA', title: 'IndiaAI Fellowship 2026–27', date: 'LAST DATE: 30 NOV', src: 'Business Today · EducationPost · Biotecnika',
    pts: [{t: () => wt(20, 'UG'), x: '🎓  UG students: ₹1 लाख तक'}, {t: () => wt(20, 'PG'), x: '🎓  PG students: ₹2 लाख तक'}, {t: () => wt(21, 'PhD'), x: '🔗  fellowship.indiaai.gov.in'}], note: 'PhD: official portal check करें'},
];

const NewsCard: React.FC<{k: number}> = ({k}) => {
  const n = NEWS[k]; const {t} = useT();
  const first = n.lines[0], last = n.lines[n.lines.length - 1];
  const t0 = st(first) - 0.1, t1 = en(last) + 0.35;
  if (t < t0 || t >= t1) return null;
  const li = n.lines.filter((i) => t >= st(i) - 0.12).pop() ?? first;
  const w = 640;
  const money = k === 3 ? Math.round(200000 * ease(ramp(t, wt(20, 'PG'), wt(20, 'PG') + 1.2))) : 0;
  return (
    <Pop t0={t0} t1={t1} dir={sideOf(li) === 'left' ? 'l' : 'r'} style={{...cardPos(li, w, 140), transition: 'none'}}>
      {({sheen}) => (
        <Glass sheen={sheen} style={{padding: '26px 30px 22px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Chip color={C.saffron}>AI NEWS · {String(k + 1).padStart(2, '0')}/04</Chip>
            <Chip color={'#fff'} size={18}>{n.date}</Chip>
          </div>
          <div style={{fontFamily: F.bold, fontSize: 22, letterSpacing: 3, color: C.cyan, marginTop: 18}}>{n.org}</div>
          <div style={{fontFamily: F.head, fontSize: n.title.length > 18 ? 44 : 56, color: '#fff', lineHeight: 1.08, marginTop: 4}}>{n.title}</div>
          {k === 3 && t >= wt(20, 'PG') && (
            <div style={{fontFamily: F.head, fontSize: 78, marginTop: 6, background: `linear-gradient(90deg, ${C.gold}, ${C.saffron})`, WebkitBackgroundClip: 'text', color: 'transparent'}}>
              ₹{money.toLocaleString('en-IN')}
            </div>
          )}
          <div style={{marginTop: 14}}>
            {n.pts.map((p, i) => {
              const a = p.t(); const v = ease(ramp(t, a - 0.1, a + 0.35)); if (v <= 0) return null;
              return (
                <div key={i} style={{fontFamily: F.deva, fontSize: 30, color: '#fff', padding: '9px 14px', marginTop: 8, borderRadius: 16,
                  background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', transform: `translateX(${(1 - v) * 40}px)`, opacity: v}}>{p.x}</div>
              );
            })}
          </div>
          {n.note && t >= n.pts[n.pts.length - 1].t() && <div style={{fontFamily: F.deva, fontSize: 22, color: C.gold, marginTop: 12}}>{n.note}</div>}
          <div style={{fontFamily: F.bold, fontSize: 17, color: 'rgba(255,255,255,0.62)', marginTop: 14, letterSpacing: 0.5}}>SOURCES: {n.src}</div>
        </Glass>
      )}
    </Pop>
  );
};

const LESSONS = [
  {line: 27, a: 'Idea की value = 0', b: 'Value है उसे रोज़ थोड़ा-थोड़ा बनाने में'},
  {line: 28, a: 'Perfect का इंतज़ार मत करो', b: 'पहला version थोड़ा बुरा होगा — और यही सही है'},
  {line: 30, a: 'Consistency > Idea', b: 'लोग आपकी consistency याद रखते हैं'},
];

const ChapterCard: React.FC<{t0: number; t1: number; n: string; title: string; sub: string; tint?: string}> = ({t0, t1, n, title, sub, tint}) => (
  <Pop t0={t0} t1={t1} dir="s" style={{left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center'}}>
    {({sheen}) => (
      <Glass sheen={sheen} tint={tint} style={{padding: '34px 70px 40px', textAlign: 'center', minWidth: 900}}>
        <div style={{fontFamily: F.bold, fontSize: 26, letterSpacing: 10, color: C.saffron}}>{n}</div>
        <div style={{fontFamily: F.head, fontSize: 104, color: '#fff', lineHeight: 1.05, marginTop: 6}}>{title}</div>
        <div style={{fontFamily: F.deva, fontSize: 38, color: 'rgba(255,255,255,0.85)', marginTop: 8}}>{sub}</div>
      </Glass>
    )}
  </Pop>
);

const Overlays: React.FC = () => {
  const {t} = useT();
  const k = lineAt(t);
  const letter = 1 - ease(ramp(t, TITLE0, TITLE0 + 0.6));
  const scramble = (s: string, seed: number) => { const R = rng(Math.floor(t * 14) + seed); return s.split('').map((c) => (c === ' ' ? ' ' : '█▓▒░#$%&@'[Math.floor(R() * 9)])).join(''); };
  const chapIdx = CHAPTERS.findIndex((c) => t >= c.t0 && t < c.t1);
  return (
    <AbsoluteFill>
      {/* cinematic letterbox for the cold open */}
      {letter > 0 && <>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 118 * letter, background: '#000'}} />
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 118 * letter, background: '#000'}} />
      </>}

      {/* persistent: disclosure + watermark + chapter progress */}
      <div style={{position: 'absolute', left: 34, top: 30, padding: '7px 16px', borderRadius: 999, background: 'rgba(10,12,24,0.45)', border: '1px solid rgba(255,255,255,0.22)',
        fontFamily: F.bold, fontSize: 17, color: 'rgba(255,255,255,0.88)', letterSpacing: 1, backdropFilter: 'blur(12px)'}}>
        <span style={{color: C.cyan}}>●</span>&nbsp; AI-GENERATED VIRTUAL CREATOR
      </div>
      <div style={{position: 'absolute', right: 34, top: 30, padding: '7px 18px', borderRadius: 999, background: 'rgba(10,12,24,0.45)', border: '1px solid rgba(255,255,255,0.22)',
        fontFamily: F.head, fontSize: 19, color: '#fff', letterSpacing: 2, backdropFilter: 'blur(12px)'}}>
        UNFILTERED <span style={{color: C.saffron}}>AVIR</span>
      </div>
      {t > TITLE1 && t < en(39) + 0.2 && (
        <div style={{position: 'absolute', left: 560, width: 800, top: 32, display: 'flex', gap: 8, opacity: ease(ramp(t, TITLE1, TITLE1 + 0.6))}}>
          {CHAPTERS.map((c, i) => {
            const p = clamp01((t - c.t0) / (c.t1 - c.t0)); const on = i === chapIdx;
            return (
              <div key={i} style={{flex: c.n.length + 6, height: 30, borderRadius: 999, position: 'relative', overflow: 'hidden', background: 'rgba(10,12,24,0.42)',
                border: `1px solid ${on ? C.saffron : 'rgba(255,255,255,0.2)'}`, backdropFilter: 'blur(12px)'}}>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p * 100}%`, background: on ? 'rgba(255,159,28,0.45)' : 'rgba(255,255,255,0.16)'}} />
                <div style={{position: 'relative', textAlign: 'center', fontFamily: F.bold, fontSize: 14, lineHeight: '30px', letterSpacing: 2, color: on ? '#fff' : 'rgba(255,255,255,0.6)'}}>{c.n}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- cold open ---- */}
      <Pop t0={st(0) - 0.2} t1={en(0) + 0.6} dir="l" style={{left: 120, top: 380}}>
        {({sheen}) => <Glass sheen={sheen} style={{padding: '16px 26px'}}><div style={{fontFamily: F.bold, fontSize: 24, letterSpacing: 4, color: C.gold}}>🪔 SUNDAY · 8 NOV 2026</div>
          <div style={{fontFamily: F.deva, fontSize: 34, color: '#fff', marginTop: 2}}>Diwali की रात</div></Glass>}
      </Pop>
      <Pop t0={wt(1, 'नाम')} t1={en(1) + 0.3} dir="r" style={{left: 1330, top: 330, width: 500}}>
        {({sheen}) => (
          <Glass sheen={sheen} tint="255,80,90" style={{padding: '22px 28px'}}>
            <Chip color={'#ffb3b8'}>🔒 SECRET PROJECT</Chip>
            <div style={{fontFamily: F.bold, fontSize: 22, color: 'rgba(255,255,255,0.7)', marginTop: 14, letterSpacing: 2}}>NAME</div>
            <div style={{fontFamily: 'monospace', fontSize: 50, color: '#fff', letterSpacing: 4}}>{scramble('XXXXXXX', 5)}</div>
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(2, 'end')} t1={en(2) + 0.2} dir="r" style={{left: 1330, top: 330, width: 500}}>
        {({sheen}) => {
          const p = ramp(t, wt(2, 'end'), en(2));
          return (
            <Glass sheen={sheen} style={{padding: '22px 28px'}}>
              <Chip color={C.gold}>⏳ पहला इशारा</Chip>
              <div style={{fontFamily: F.head, fontSize: 46, color: '#fff', marginTop: 12}}>@ 3:20</div>
              <div style={{height: 10, borderRadius: 9, background: 'rgba(255,255,255,0.15)', marginTop: 12, overflow: 'hidden'}}>
                <div style={{width: `${8 + 80 * ease(p)}%`, height: '100%', background: `linear-gradient(90deg, ${C.saffron}, ${C.gold})`}} /></div>
              <div style={{fontFamily: F.deva, fontSize: 24, color: 'rgba(255,255,255,0.8)', marginTop: 10}}>video के end में</div>
            </Glass>
          );
        }}
      </Pop>

      {/* ---- title card ---- */}
      {t >= TITLE0 && t < TITLE1 && <Twinkles opacity={ramp(t, TITLE0, TITLE0 + 0.4) * (1 - ramp(t, TITLE1 - 0.3, TITLE1))} />}
      <Pop t0={TITLE0} t1={TITLE1} dir="s" style={{left: 0, right: 0, top: 270, display: 'flex', justifyContent: 'center'}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '40px 90px 46px', textAlign: 'center'}} radius={40}>
            <div style={{fontFamily: F.head, fontSize: 132, lineHeight: 1, background: 'linear-gradient(180deg, #ffffff 30%, #9ff4ff 100%)', WebkitBackgroundClip: 'text', color: 'transparent'}}>
              UNFILTERED <span style={{background: `linear-gradient(180deg, ${C.gold}, ${C.saffron})`, WebkitBackgroundClip: 'text', color: 'transparent'}}>AVIR</span></div>
            <div style={{fontFamily: F.bold, fontSize: 30, letterSpacing: 12, color: C.saffron, marginTop: 18}}>EP 01 · DIWALI SUNDAY SPECIAL</div>
            <div style={{fontFamily: F.bold, fontSize: 26, color: 'rgba(255,255,255,0.75)', marginTop: 10, letterSpacing: 2}}>Real experiments. Unfiltered results.</div>
          </Glass>
        )}
      </Pop>

      {/* ---- intro ---- */}
      <Bursts bursts={[{at: st(3) + 0.1, x: 480, y: 300}, {at: st(3) + 0.5, x: 1450, y: 260}, {at: st(3) + 0.95, x: 960, y: 180, r: 380},
        {at: st(38) + 0.2, x: 450, y: 280}, {at: st(38) + 0.7, x: 1480, y: 240}, {at: st(38) + 1.3, x: 960, y: 170, r: 400}, {at: st(38) + 2.2, x: 700, y: 320}, {at: st(38) + 3.0, x: 1250, y: 300}]} />
      {[3, 38].map((i) => (
        <Pop key={i} t0={wt(i, 'happy') - 0.15} t1={en(i) + 0.3} dir="s" style={{left: 0, right: 0, top: 120, textAlign: 'center'}}>
          {() => <>
            <div style={{fontFamily: F.head, fontSize: 150, lineHeight: 1, background: `linear-gradient(180deg, #fff6d0 0%, ${C.gold} 45%, ${C.saffron} 100%)`, WebkitBackgroundClip: 'text', color: 'transparent',
              filter: 'drop-shadow(0 0 28px rgba(255,180,40,0.75)) drop-shadow(0 6px 12px rgba(0,0,0,0.5))'}}>HAPPY DIWALI</div>
            <div style={{fontFamily: F.deva, fontSize: 64, color: '#fff', marginTop: 4, textShadow: '0 0 24px rgba(255,160,40,0.8), 0 4px 10px rgba(0,0,0,0.6)'}}>शुभ दीपावली 🪔</div>
          </>}
        </Pop>
      ))}
      {[['रोशनी', '🪔  घर में रोशनी'], ['सुकून', '💛  दिल में सुकून'], ['wifi', '📶  WiFi में speed 🚀']].map(([w, x], i) => (
        <Pop key={w} t0={wt(4, w) - 0.1} t1={en(4) + 0.3} dir="r" style={{left: 1300, top: 250 + i * 112}}>
          {({sheen}) => <Glass sheen={sheen} style={{padding: '18px 30px'}}><div style={{fontFamily: F.deva, fontSize: 40, color: i === 2 ? C.cyan : '#fff'}}>{x}</div></Glass>}
        </Pop>
      ))}
      <Pop t0={wt(5, 'avir') - 0.1} t1={en(6) + 0.2} dir="l" style={{left: 80, top: 650}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '20px 34px 22px 30px', display: 'flex'}}>
            <div style={{display: 'flex', gap: 22, alignItems: 'center'}}>
              <div style={{width: 10, alignSelf: 'stretch', borderRadius: 6, background: `linear-gradient(180deg, ${C.saffron}, ${C.cyan})`}} />
              <div>
                <div style={{fontFamily: F.head, fontSize: 72, color: '#fff', lineHeight: 1}}>Avir</div>
                <div style={{fontFamily: F.bold, fontSize: 24, color: C.cyan, letterSpacing: 2, marginTop: 6}}>VIRTUAL CREATOR · AI-GENERATED CHARACTER</div>
                <div style={{fontFamily: F.bold, fontSize: 21, color: 'rgba(255,255,255,0.75)', marginTop: 6}}>YouTube @unfilteredavir · Instagram @unfiltered.avir</div>
              </div>
            </div>
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(6, 'digital')} t1={en(6) + 0.2} dir="l" style={{left: 110, top: 300}}>
        {({sheen}) => <Glass sheen={sheen} style={{padding: '18px 28px', textAlign: 'center'}}><div style={{fontFamily: F.bold, fontSize: 22, letterSpacing: 3, color: 'rgba(255,255,255,0.7)'}}>FACE</div>
          <div style={{fontFamily: F.head, fontSize: 54, color: C.cyan}}>DIGITAL 🤖</div></Glass>}
      </Pop>
      <Pop t0={wt(6, 'असली')} t1={en(6) + 0.2} dir="r" style={{left: 1420, top: 300}}>
        {({sheen}) => <Glass sheen={sheen} tint="80,255,170" style={{padding: '18px 28px', textAlign: 'center'}}><div style={{fontFamily: F.bold, fontSize: 22, letterSpacing: 3, color: 'rgba(255,255,255,0.7)'}}>EXPERIMENTS + RESULTS</div>
          <div style={{fontFamily: F.head, fontSize: 54, color: C.green}}>100% REAL ✅</div></Glass>}
      </Pop>
      <Pop t0={st(7) - 0.1} t1={en(7) + 0.3} dir="l" style={{left: 80, top: 280}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '30px 40px'}}>
            {[['Real', 'experiments.', 'real'], ['Unfiltered', 'results.', 'unfiltered']].map(([a, b, w], i) => (
              <div key={i} style={{fontFamily: F.head, fontSize: 70, lineHeight: 1.12, color: '#fff', opacity: ease(ramp(t, wt(7, w) - 0.1, wt(7, w) + 0.2)),
                transform: `translateY(${(1 - ease(ramp(t, wt(7, w) - 0.1, wt(7, w) + 0.25))) * 24}px)`}}>
                <span style={{color: i ? C.saffron : C.cyan}}>{a}</span> {b}</div>
            ))}
            <div style={{fontFamily: F.deva, fontSize: 30, color: 'rgba(255,255,255,0.8)', marginTop: 8, opacity: ease(ramp(t, wt(7, 'वादा') - 0.2, wt(7, 'वादा') + 0.2))}}>— इस channel का वादा</div>
          </Glass>
        )}
      </Pop>
      <Pop t0={st(8) - 0.1} t1={en(11) + 0.3} dir="r" style={{left: 1240, top: 200, width: 600}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '26px 30px'}}>
            <Chip color={C.saffron}>आज की VIDEO में</Chip>
            {[[9, '01', 'इस हफ़्ते की AI news'], [10, '02', 'Founder की असली ज़िंदगी'], [11, '03', 'Startup का पहला इशारा 🔒']].map(([i, n, x]) => {
              const on = t >= st(i as number) - 0.12; const cur = k === i;
              return (
                <div key={n as string} style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 16, padding: '12px 16px', borderRadius: 18,
                  background: cur ? 'rgba(255,159,28,0.22)' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${cur ? C.saffron : 'rgba(255,255,255,0.12)'}`, opacity: on ? 1 : 0.45}}>
                  <div style={{fontFamily: F.head, fontSize: 40, color: on ? C.saffron : '#fff', width: 64}}>{n}</div>
                  <div style={{fontFamily: F.deva, fontSize: 32, color: '#fff'}}>{x}</div>
                </div>
              );
            })}
          </Glass>
        )}
      </Pop>

      {/* ---- chapter cards ---- */}
      <ChapterCard t0={en(11) + 0.05} t1={st(12) + 0.35} n="CHAPTER 01" title="AI NEWS" sub="इस हफ़्ते की 4 बड़ी ख़बरें" />
      <ChapterCard t0={en(21) + 0.05} t1={st(22) + 0.35} n="CHAPTER 02" title="FOUNDER LIFE" sub="जो Instagram पर नहीं दिखता" />
      <ChapterCard t0={en(31) + 0.05} t1={st(32) + 0.35} n="CHAPTER 03" title="TOP SECRET 🔒" sub="मेरा startup" tint="255,70,80" />

      {/* ---- news ---- */}
      {NEWS.map((_, i) => <NewsCard key={i} k={i} />)}

      {/* ---- founder ---- */}
      <Pop t0={st(23) - 0.1} t1={en(23) + 0.2} dir="s" style={{left: 90, top: 300}}>
        {() => <div style={{fontFamily: F.head, fontSize: 110, lineHeight: 0.95, color: 'transparent', WebkitTextStroke: '3px #fff', textShadow: '0 0 30px rgba(255,255,255,0.25)'}}>FOUNDER<br /><span style={{WebkitTextStroke: `3px ${C.saffron}`}}>LIFE</span></div>}
      </Pop>
      <Pop t0={st(24) - 0.1} t1={en(24) + 0.2} dir="l" style={{left: 80, top: 180, width: 560}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '24px 28px'}}>
            <Chip color={C.gold}>👀 बाहर से</Chip>
            {[['office', '🏢  बड़ा office'], ['funding', '💸  Funding'], ['congrat', '🎉  Congratulations!']].map(([w, x]) => {
              const v = ease(ramp(t, wt(24, w) - 0.1, wt(24, w) + 0.3)); if (v <= 0) return null;
              return <div key={w} style={{fontFamily: F.deva, fontSize: 38, color: '#fff', marginTop: 14, padding: '10px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.1)',
                transform: `scale(${0.85 + 0.15 * v})`, transformOrigin: 'left center', opacity: v}}>{x}</div>;
            })}
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(25, 'रात') - 0.1} t1={en(25) + 0.2} dir="l" style={{left: 80, top: 210, width: 600}}>
        {({sheen}) => {
          const sun = t >= NIGHT1;
          const lines = [['$ npm run build', '#cfd6ff'], ['✗ Error: build failed', C.red], ['✗ TypeError: undefined', C.red], ['… fixing (chai #3 ☕)', C.gold], ['✓ bug fixed', C.green]];
          const shown = Math.floor(ramp(t, wt(25, 'रात'), NIGHT1 - 0.2) * lines.length + 0.999);
          return (
            <Glass sheen={sheen} tint={sun ? '255,190,90' : '120,140,255'} style={{padding: '18px 24px 22px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 9}}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />)}
                <div style={{flex: 1}} />
                <div style={{fontFamily: F.head, fontSize: 40, color: sun ? C.gold : '#fff'}}>{sun ? '☀️ 7:00 AM' : '🌙 3:00 AM'}</div>
              </div>
              {!sun ? lines.slice(0, shown).map(([x, c], i) => <div key={i} style={{fontFamily: 'monospace', fontSize: 28, color: c, marginTop: 10}}>{x}</div>)
                : <div style={{fontFamily: F.deva, fontSize: 40, color: '#fff', marginTop: 18}}>फिर से वही सपना ✨</div>}
            </Glass>
          );
        }}
      </Pop>
      <Pop t0={st(26) - 0.1} t1={en(30) + 0.3} dir="d" style={{left: 1240, top: 120, width: 600}}>
        {() => <Chip color={C.saffron} size={24} style={{background: 'rgba(10,12,24,0.5)', backdropFilter: 'blur(12px)'}}>🧠 FOUNDER LESSONS ·
          {[27, 28, 30].map((i) => <span key={i} style={{color: t >= st(i) - 0.12 ? C.saffron : 'rgba(255,255,255,0.35)'}}>●</span>)}</Chip>}
      </Pop>
      {LESSONS.map((ls, i) => (
        <Pop key={i} t0={st(ls.line) - 0.1} t1={en(ls.line) + 0.25} dir="r" style={{left: 1220, top: 200, width: 620}}>
          {({sheen}) => (
            <Glass sheen={sheen} style={{padding: '24px 32px 30px'}}>
              <div style={{fontFamily: F.head, fontSize: 130, lineHeight: 1, color: 'transparent', WebkitTextStroke: `3px ${C.saffron}`}}>0{i + 1}</div>
              <div style={{fontFamily: F.deva, fontSize: 46, color: '#fff', lineHeight: 1.2, marginTop: 8}}>{ls.a}</div>
              <div style={{fontFamily: F.deva, fontSize: 32, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, marginTop: 10}}>{ls.b}</div>
            </Glass>
          )}
        </Pop>
      ))}
      <Pop t0={wt(29, 'version') - 0.1} t1={en(29) + 0.25} dir="l" style={{left: 90, top: 170, width: 470}}>
        {({sheen}) => {
          const tape = ease(ramp(t, wt(29, 'देखना'), wt(29, 'देखना') + 0.15));
          return (
            <Glass sheen={sheen} style={{padding: 18}}>
              <div style={{fontFamily: F.head, fontSize: 40, color: '#fff', marginBottom: 10}}>AVIR <span style={{color: C.saffron}}>v0.1</span> 😅</div>
              <div style={{position: 'relative', borderRadius: 18, overflow: 'hidden', height: 470}}>
                <Img src={staticFile('ep1/v01.png')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${2 + 6 * tape}px)`}} />
                {tape > 0 && <div style={{position: 'absolute', left: -40, right: -40, top: 190, padding: '12px 0', background: C.red, transform: `rotate(-14deg) scale(${1.6 - 0.6 * tape})`,
                  fontFamily: F.head, fontSize: 44, color: '#fff', textAlign: 'center', letterSpacing: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>DON'T LOOK 🙈</div>}
              </div>
            </Glass>
          );
        }}
      </Pop>
      <Pop t0={wt(31, 'sunday') - 0.1} t1={en(31) + 0.25} dir="r" style={{left: 1300, top: 220, width: 520}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '24px 28px'}}>
            <Chip color={C.cyan}>📅 EVERY SUNDAY</Chip>
            <div style={{display: 'flex', gap: 12, marginTop: 16}}>
              {['8 NOV', '15 NOV', '22 NOV', '29 NOV'].map((d, i) => (
                <div key={d} style={{flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 16, background: i === 0 ? 'rgba(61,255,162,0.22)' : 'rgba(255,255,255,0.07)',
                  border: `1.5px solid ${i === 0 ? C.green : 'rgba(255,255,255,0.15)'}`}}>
                  <div style={{fontFamily: F.bold, fontSize: 20, color: '#fff'}}>{d}</div><div style={{fontSize: 26}}>{i === 0 ? '✅' : '🎬'}</div></div>
              ))}
            </div>
          </Glass>
        )}
      </Pop>

      {/* ---- startup ---- */}
      <Pop t0={st(32) - 0.1} t1={en(33) + 0.2} dir="l" style={{left: 90, top: 250, width: 520}}>
        {({sheen}) => {
          const load = t >= st(33) - 0.12;
          const p = load ? 0.12 + 0.87 * ease(ramp(t, st(33), en(33) - 0.2)) : 0;
          return (
            <Glass sheen={sheen} tint="255,70,80" border="rgba(255,90,100,0.6)" style={{padding: '24px 30px'}}>
              <div style={{fontFamily: F.head, fontSize: 52, color: C.red, letterSpacing: 3}}>⚠ TOP SECRET</div>
              {load && <>
                <div style={{fontFamily: F.bold, fontSize: 24, color: '#fff', marginTop: 14, letterSpacing: 2}}>STARTUP LOADING… {Math.floor(p * 100)}%</div>
                <div style={{height: 14, borderRadius: 9, background: 'rgba(255,255,255,0.15)', marginTop: 10, overflow: 'hidden'}}>
                  <div style={{width: `${p * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.red}, ${C.saffron})`}} /></div>
              </>}
            </Glass>
          );
        }}
      </Pop>
      <Pop t0={st(34) - 0.12} t1={en(34) + 0.3} dir="l" style={{left: 90, top: 200, width: 640}}>
        {({sheen}) => (
          <Glass sheen={sheen} tint="255,70,80" border="rgba(255,90,100,0.5)" style={{padding: '24px 30px 30px'}}>
            <div style={{fontFamily: F.bold, fontSize: 24, letterSpacing: 6, color: 'rgba(255,255,255,0.75)'}}>FILE: AVIR-STARTUP-001</div>
            {['NAME', 'LAUNCH DATE', 'PRODUCT'].map((x, i) => {
              const s = STAMPS[i] ?? st(34) + i; const v = ramp(t, s - 0.02, s + 0.12);
              return (
                <div key={x} style={{position: 'relative', marginTop: 20}}>
                  <div style={{fontFamily: F.bold, fontSize: 22, letterSpacing: 3, color: 'rgba(255,255,255,0.7)'}}>{x}</div>
                  <div style={{height: 44, marginTop: 6, borderRadius: 6, background: '#0b0b10', width: `${70 + 20 * ((i * 37) % 3) / 2}%`}} />
                  {v > 0 && <div style={{position: 'absolute', left: 120, top: 8, padding: '4px 22px', border: `5px solid ${C.red}`, borderRadius: 10, color: C.red,
                    fontFamily: F.head, fontSize: 46, letterSpacing: 4, transform: `rotate(${-8 + i * 5}deg) scale(${2.2 - 1.2 * ease(v)})`, opacity: Math.min(1, v * 2),
                    background: 'rgba(20,0,0,0.35)', textShadow: '0 0 12px rgba(255,59,71,0.6)'}}>CLASSIFIED</div>}
                </div>
              );
            })}
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(35, 'experiment') - 0.1} t1={en(35) + 0.25} dir="r" style={{left: 1250, top: 260, width: 590}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '24px 30px'}}>
            <div style={{fontFamily: F.bold, fontSize: 24, letterSpacing: 4, color: C.cyan}}>EXPERIMENT #001</div>
            <div style={{fontFamily: F.head, fontSize: 52, color: '#fff', marginTop: 4}}>सबसे बड़ा experiment</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontFamily: F.bold, fontSize: 26, color: '#fff'}}>
              <div style={{width: 16, height: 16, borderRadius: 8, background: C.green, boxShadow: `0 0 ${10 + 8 * Math.sin(t * 6)}px ${C.green}`}} /> STATUS: BUILDING</div>
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(36, 'comment') - 0.1} t1={en(36) + 0.3} dir="r" style={{left: 1180, top: 230, width: 660}}>
        {({sheen}) => {
          const typed = 'मेरा guess: '; const n = Math.floor(ramp(t, wt(36, 'comment'), wt(36, 'comment') + 1.2) * typed.length);
          const blink = Math.floor(t * 2.5) % 2 === 0;
          return (
            <Glass sheen={sheen} style={{padding: '24px 28px'}}>
              <div style={{fontFamily: F.bold, fontSize: 24, letterSpacing: 3, color: C.saffron}}>💬 COMMENT YOUR GUESS</div>
              <div style={{display: 'flex', gap: 16, alignItems: 'center', marginTop: 16}}>
                <div style={{width: 58, height: 58, borderRadius: 29, background: `linear-gradient(135deg, ${C.saffron}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: F.head, fontSize: 30, color: '#fff'}}>?</div>
                <div style={{flex: 1, borderBottom: '2px solid rgba(255,255,255,0.5)', fontFamily: F.deva, fontSize: 34, color: '#fff', paddingBottom: 6}}>
                  {typed.slice(0, n)}<span style={{opacity: blink ? 1 : 0}}>|</span></div>
              </div>
              {t >= wt(36, 'pin') - 0.2 && <div style={{fontFamily: F.deva, fontSize: 30, color: C.gold, marginTop: 18}}>📌 सबसे close guess → अगली video में pin</div>}
            </Glass>
          );
        }}
      </Pop>

      {/* ---- outro ---- */}
      <Pop t0={st(37) - 0.1} t1={en(37) + 0.3} dir="u" style={{left: 1260, top: 300, width: 560}}>
        {() => {
          const c = wt(37, 'subscribe'); const click = t >= c + 0.35; const press = t >= c + 0.25 && t < c + 0.45;
          const cx = 380 - 140 * ease(ramp(t, c - 0.5, c + 0.25)), cy = 150 - 60 * ease(ramp(t, c - 0.5, c + 0.25));
          return (
            <div style={{position: 'relative', height: 260}}>
              <Glass tint={click ? '255,255,255' : '255,59,71'} style={{padding: '26px 30px', textAlign: 'center', transform: `scale(${press ? 0.94 : 1})`,
                border: click ? '1.5px solid rgba(255,255,255,0.4)' : `2px solid ${C.red}`}}>
                <div style={{fontFamily: F.head, fontSize: 52, color: click ? 'rgba(255,255,255,0.85)' : '#fff', letterSpacing: 3}}>{click ? 'SUBSCRIBED ✓' : 'SUBSCRIBE'}</div>
                <div style={{fontFamily: F.deva, fontSize: 28, color: C.gold, marginTop: 6}}>{click ? '🔔 हर Sunday नई video' : 'Real experiments. Unfiltered results.'}</div>
              </Glass>
              <div style={{position: 'absolute', left: cx, top: cy, fontSize: 64, transform: `scale(${press ? 0.85 : 1})`, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'}}>👆</div>
            </div>
          );
        }}
      </Pop>
      <Pop t0={wt(38, 'पटाख़े') - 0.1} t1={en(38) + 0.3} dir="r" style={{left: 1320, top: 520}}>
        {({sheen}) => <Glass sheen={sheen} style={{padding: '16px 26px'}}><div style={{fontFamily: F.deva, fontSize: 36, color: '#fff'}}>🎆 पटाख़े — थोड़ा दूर से!</div></Glass>}
      </Pop>
      {t >= en(39) + 0.1 && <Twinkles seed={9} opacity={ramp(t, en(39) + 0.1, en(39) + 0.6)} />}
      <Pop t0={en(39) + 0.1} t1={DATA.total + 1} dir="s" style={{left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center'}}>
        {({sheen}) => (
          <Glass sheen={sheen} radius={40} style={{padding: '40px 80px', textAlign: 'center'}}>
            <div style={{fontFamily: F.deva, fontSize: 72, color: '#fff'}}>मिलते हैं अगले Sunday 👋</div>
            <div style={{fontFamily: F.head, fontSize: 44, color: C.saffron, marginTop: 10, letterSpacing: 2}}>UNFILTERED AVIR</div>
            <div style={{fontFamily: F.bold, fontSize: 26, color: 'rgba(255,255,255,0.85)', marginTop: 12}}>YouTube @unfilteredavir · Instagram @unfiltered.avir</div>
          </Glass>
        )}
      </Pop>

      {/* captions (hidden on full-screen cards) */}
      {k >= 0 && !(t >= TITLE0 && t < TITLE1) && <Captions words={L[k].words} end={en(k)} bottom={letter > 0.5 ? 30 : 58} size={letter > 0.5 ? 44 : 50} />}

      {/* fade from / to black */}
      <AbsoluteFill style={{background: '#000', opacity: Math.max(1 - ramp(t, 0, 0.6), ramp(t, DATA.total - 0.6, DATA.total))}} />
    </AbsoluteFill>
  );
};

export const Ep1: React.FC = () => {
  const {t, frame} = useT();
  const shot = shotAt(t);
  const z = zoomAt(t); const [sx, sy] = shakeAt(t);
  const g = gradeAt(t);
  const {face, nod} = faceAt(t, frame);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px) scale(${z})`, transformOrigin: ORIGIN[shot], filter: g.filter}}>
        <Img src={staticFile(`ep1/plates/bg_${shot}.png`)} style={{position: 'absolute', width: '100%', height: '100%'}} />
        {LAYERS !== 'nothree' && <ThreeCanvas width={CW} height={CH} style={{width: 1920, height: 1080}} gl={{antialias: IP.aa !== false, alpha: true, preserveDrawingBuffer: true}}>
          {IP.nolights ? <ambientLight intensity={2} /> : <AvirLights night={g.night} warm={1 - 0.3 * g.secret} />}
          <AvirLayer t={t} cam={(CAMS as any)[shot]} segs={SEGS} face={face} nod={nod} />
        </ThreeCanvas>}
        <Img src={staticFile(`ep1/plates/fg_${shot}.png`)} style={{position: 'absolute', width: '100%', height: '100%'}} />
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,${0.36 + 0.3 * g.secret}) 100%)`}} />
      </AbsoluteFill>
      {LAYERS !== 'noui' && <Overlays />}
      <Audio src={staticFile('ep1/ep1_mix.wav')} />
    </AbsoluteFill>
  );
};
