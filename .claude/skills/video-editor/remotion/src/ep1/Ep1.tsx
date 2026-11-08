// EP001 — "Diwali Sunday": Avir in his studio. Cycles background plate + three.js Avir + Cycles foreground plate,
// graded together, with a light glass UI, captions and the final mix on top. Acting and shot plan live in perf.ts.
import React from 'react';
import {AbsoluteFill, Audio, Img, getInputProps, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from './Avir';
import {Bursts, C, Captions, Chip, F, Glass, Pop, Twinkles, clamp01, ease, ramp, rng, useT} from './ui';
import {L, SHOTS, en, faceAt, lineAt, perfAt, posesAt, shotAt, st} from './perf';
import {Broll, BrollScene} from './screens';
import DATA from './data.json';
import CAMS from './cams.json';

const IP = getInputProps() as any;
const LAYERS = String(IP.layers ?? 'all');
export const EP1_TOTAL = DATA.total;
const wt = (i: number, sub: string, nth = 0) => L[i].words.filter((w) => w.w.toLowerCase().includes(sub.toLowerCase()))[nth]?.t0 ?? L[i].start;
const TITLE0 = en(2) + 0.25, TITLE1 = st(3) - 0.1;
const LENS = (CAMS as any).close.pos as number[];   // Avir talks to the main (close/medium) camera

// ---------- B-roll: full-screen screens/memes; over 4 s Avir shrinks into a corner window ----------
const BROLL = DATA.cue.broll as Broll[];
const brollAt = (t: number) => BROLL.find((b) => t >= b.t0 && t < b.t1);
const PIPS: [number, number][] = [];
for (const b of BROLL.filter((x) => x.pip)) { const l = PIPS[PIPS.length - 1]; if (l && b.t0 - l[1] < 0.06) l[1] = b.t1; else PIPS.push([b.t0, b.t1]); }
const PIP_BOX = {x: 1368, y: 752, w: 512};
const pipAt = (t: number) => { for (const [a, b] of PIPS) if (t >= a && t < b) return ease(ramp(t, a, a + 0.45)) * (1 - ease(ramp(t, b - 0.4, b))); return 0; };

// ---------- view: shot plan + punch-ins + shake ----------
const PUNCH = [
  {a: wt(4, 'wifi'), b: en(4), z: 0.07},
  {a: wt(29, 'देखा'), b: en(29), z: 0.1},
];
const STAMPS = DATA.cue.classified as number[];
const viewAt = (t: number) => {
  const s = shotAt(t); const p = ease(clamp01((t - s.t0) / Math.max(0.5, s.t1 - s.t0)));
  let z = s.z0 + (s.z1 - s.z0) * p;
  for (const q of PUNCH) z += q.z * ease(ramp(t, q.a, q.a + 0.18)) * (1 - ease(ramp(t, q.b, q.b + 0.3)));
  for (const x of STAMPS) if (t >= x && t < x + 0.5) z += 0.035 * Math.exp(-(t - x) * 9);
  return {cam: s.cam, z, ox: s.ox + s.dx * p, oy: s.oy};
};
const shakeAt = (t: number) => { let x = 0, y = 0; for (const s of STAMPS) if (t >= s && t < s + 0.3) { const e = Math.exp(-(t - s) * 14); x += 8 * e * Math.sin(t * 95); y += 5 * e * Math.cos(t * 81); } return [x, y]; };

// ---------- grade ----------
const NIGHT0 = wt(25, 'रात'), NIGHT1 = wt(25, 'सुबह');
const gradeAt = (t: number) => {
  const title = ramp(t, TITLE0, TITLE0 + 0.3) * (1 - ramp(t, TITLE1 - 0.25, TITLE1));
  const endc = ramp(t, en(39) + 0.1, en(39) + 0.6);
  const night = ramp(t, NIGHT0 - 0.1, NIGHT0 + 0.3) * (1 - ramp(t, NIGHT1, NIGHT1 + 0.6));
  const secret = ramp(t, st(32) - 0.4, st(32)) * (1 - ramp(t, en(34), en(34) + 0.6));
  const blur = Math.max(title, endc) * 14;
  const bright = 1 - 0.38 * Math.max(title, endc) - 0.2 * night - 0.1 * secret;
  return {filter: `contrast(${1.07 + 0.08 * secret}) saturate(${1.14 - 0.25 * night - 0.3 * secret}) brightness(${bright}) hue-rotate(${-10 * night}deg)${blur > 0.3 ? ` blur(${blur}px)` : ''}`,
    night, secret};
};

// ---------- overlays (one card at a time, kept off Avir's face) ----------
const HEADS: [number, string, string][] = [[12, '1/4', 'OpenAI · ChatGPT'], [15, '2/4', 'Google · Gemini'], [17, '3/4', 'Anthropic · Claude'], [19, '4/4', 'IndiaAI Fellowship']];
const HeadChip: React.FC<{i: number; n: string; org: string}> = ({i, n, org}) => (
  <Pop t0={st(i) + (i === 12 ? 2.2 : 0.1)} t1={en(i) + 0.2} dir="r" style={{left: 1920 - 80 - 520, top: 200, width: 520}}>
    {({sheen}) => <Glass sheen={sheen} style={{padding: '18px 26px'}}>
      <div style={{fontFamily: F.bold, fontSize: 19, letterSpacing: 4, color: C.saffron}}>AI NEWS {n}</div>
      <div style={{fontFamily: F.head, fontSize: 44, color: '#fff', lineHeight: 1.1, marginTop: 4}}>{org}</div></Glass>}
  </Pop>
);
const LESSONS = [
  {line: 27, a: 'Idea की value = 0', b: 'रोज़ थोड़ा-थोड़ा बनाओ'},
  {line: 28, a: 'Perfect का इंतज़ार मत करो', b: 'पहला version बुरा होगा — ठीक है'},
  {line: 30, a: 'Consistency > Idea', b: 'लोग consistency याद रखते हैं'},
];
const Section: React.FC<{t0: number; t1: number; n: string; title: string}> = ({t0, t1, n, title}) => (
  <Pop t0={t0} t1={t1} dir="l" style={{left: 80, top: 120}}>
    {({sheen}) => <Glass sheen={sheen} style={{padding: '14px 26px'}}>
      <div style={{fontFamily: F.bold, fontSize: 18, letterSpacing: 6, color: C.saffron}}>{n}</div>
      <div style={{fontFamily: F.head, fontSize: 46, color: '#fff', lineHeight: 1.05}}>{title}</div></Glass>}
  </Pop>
);

const Overlays: React.FC = () => {
  const {t} = useT();
  const k = lineAt(t);
  const letter = 1 - ease(ramp(t, TITLE0, TITLE0 + 0.6));
  const scramble = (s: string, seed: number) => { const R = rng(Math.floor(t * 12) + seed); return s.split('').map(() => '█▓▒░#%&@'[Math.floor(R() * 8)]).join(''); };
  return (
    <AbsoluteFill>
      {(() => { const b = brollAt(t); return b && !b.pip ? <BrollScene b={b} /> : null; })()}
      {letter > 0 && <>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 110 * letter, background: '#000'}} />
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 * letter, background: '#000'}} />
      </>}
      {/* AI disclosure, always on */}
      <div style={{position: 'absolute', left: 32, top: 30, padding: '6px 14px', borderRadius: 999, background: 'rgba(10,12,24,0.45)', border: '1px solid rgba(255,255,255,0.2)',
        fontFamily: F.bold, fontSize: 15, color: 'rgba(255,255,255,0.85)', letterSpacing: 1}}>
        <span style={{color: C.cyan}}>●</span>&nbsp; AI-generated virtual creator
      </div>

      {/* cold open */}
      <Pop t0={wt(1, 'नाम')} t1={en(1) + 0.3} dir="r" style={{left: 1400, top: 360, width: 440}}>
        {({sheen}) => <Glass sheen={sheen} style={{padding: '18px 24px'}}>
          <div style={{fontFamily: F.bold, fontSize: 18, letterSpacing: 3, color: '#ffb3b8'}}>🔒 SECRET PROJECT</div>
          <div style={{fontFamily: 'monospace', fontSize: 44, color: '#fff', letterSpacing: 4, marginTop: 6}}>{scramble('XXXXXXX', 5)}</div></Glass>}
      </Pop>

      {/* title card */}
      {t >= TITLE0 && t < TITLE1 && <Twinkles opacity={ramp(t, TITLE0, TITLE0 + 0.4) * (1 - ramp(t, TITLE1 - 0.3, TITLE1))} />}
      <Pop t0={TITLE0} t1={TITLE1} dir="s" style={{left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center'}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '36px 80px 40px', textAlign: 'center'}} radius={40}>
            <div style={{fontFamily: F.head, fontSize: 120, lineHeight: 1, color: '#fff'}}>UNFILTERED <span style={{color: C.saffron}}>AVIR</span></div>
            <div style={{fontFamily: F.bold, fontSize: 28, letterSpacing: 10, color: C.gold, marginTop: 16}}>EP 01 · DIWALI SPECIAL</div>
          </Glass>
        )}
      </Pop>

      {/* Diwali greetings */}
      <Bursts bursts={[{at: st(3) + 0.1, x: 480, y: 300}, {at: st(3) + 0.6, x: 1450, y: 260}, {at: st(38) + 0.2, x: 450, y: 280}, {at: st(38) + 0.9, x: 1480, y: 240}, {at: st(38) + 2.0, x: 960, y: 170, r: 380}]} />
      {[3, 38].map((i) => (
        <Pop key={i} t0={wt(i, 'happy') - 0.15} t1={en(i) + 0.3} dir="s" style={{left: 0, right: 0, top: 120, textAlign: 'center'}}>
          {() => <>
            <div style={{fontFamily: F.head, fontSize: 130, lineHeight: 1, background: `linear-gradient(180deg, #fff6d0 0%, ${C.gold} 45%, ${C.saffron} 100%)`, WebkitBackgroundClip: 'text', color: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(255,180,40,0.7)) drop-shadow(0 6px 12px rgba(0,0,0,0.5))'}}>HAPPY DIWALI</div>
            <div style={{fontFamily: F.deva, fontSize: 56, color: '#fff', marginTop: 4, textShadow: '0 0 20px rgba(255,160,40,0.8), 0 4px 10px rgba(0,0,0,0.6)'}}>शुभ दीपावली 🪔</div>
          </>}
        </Pop>
      ))}

      {/* who is Avir (with the AI disclosure) */}
      <Pop t0={wt(5, 'avir') - 0.1} t1={en(6) + 0.2} dir="l" style={{left: 80, top: 690}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '16px 30px 18px 24px'}}>
            <div style={{display: 'flex', gap: 18, alignItems: 'center'}}>
              <div style={{width: 8, alignSelf: 'stretch', borderRadius: 6, background: `linear-gradient(180deg, ${C.saffron}, ${C.cyan})`}} />
              <div>
                <div style={{fontFamily: F.head, fontSize: 58, color: '#fff', lineHeight: 1}}>Avir</div>
                <div style={{fontFamily: F.bold, fontSize: 21, color: C.cyan, letterSpacing: 1.5, marginTop: 6}}>Virtual creator · AI-generated character</div>
              </div>
            </div>
          </Glass>
        )}
      </Pop>
      <Pop t0={st(7) - 0.1} t1={en(7) + 0.3} dir="l" style={{left: 80, top: 300}}>
        {() => (
          <div style={{fontFamily: F.head, fontSize: 66, lineHeight: 1.1, color: '#fff', textShadow: '0 4px 18px rgba(0,0,0,0.6)'}}>
            <div style={{opacity: ease(ramp(t, wt(7, 'real') - 0.1, wt(7, 'real') + 0.2))}}><span style={{color: C.cyan}}>Real</span> experiments.</div>
            <div style={{opacity: ease(ramp(t, wt(7, 'unfiltered') - 0.1, wt(7, 'unfiltered') + 0.2))}}><span style={{color: C.saffron}}>Unfiltered</span> results.</div>
          </div>
        )}
      </Pop>
      <Pop t0={st(8) - 0.1} t1={en(11) + 0.3} dir="r" style={{left: 1300, top: 220, width: 540}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '22px 26px'}}>
            <div style={{fontFamily: F.deva, fontSize: 26, color: C.saffron}}>आज की video</div>
            {[[9, '1', 'AI news'], [10, '2', 'Founder life'], [11, '3', 'Startup का इशारा']].map(([i, n, x]) => {
              const on = t >= st(i as number) - 0.12;
              return <div key={n as string} style={{fontFamily: F.deva, fontSize: 34, color: '#fff', marginTop: 10, opacity: on ? 1 : 0.35}}>
                <span style={{fontFamily: F.head, color: k === i ? C.saffron : '#fff'}}>{n}</span>&nbsp; {x}</div>;
            })}
          </Glass>
        )}
      </Pop>

      <Section t0={st(12) - 0.3} t1={st(12) + 2.6} n="CHAPTER 1" title="AI NEWS" />
      <Section t0={st(22) - 0.3} t1={st(22) + 2.6} n="CHAPTER 2" title="FOUNDER LIFE" />
      <Section t0={st(32) - 0.3} t1={st(32) + 2.6} n="CHAPTER 3" title="TOP SECRET 🔒" />
      {HEADS.map(([i, n, org]) => <HeadChip key={i} i={i} n={n} org={org} />)}

      {LESSONS.map((ls, i) => (
        <Pop key={i} t0={st(ls.line) - 0.1} t1={en(ls.line) + 0.25} dir="r" style={{left: 1300, top: 220, width: 540}}>
          {({sheen}) => (
            <Glass sheen={sheen} style={{padding: '20px 28px 24px'}}>
              <div style={{fontFamily: F.bold, fontSize: 20, letterSpacing: 4, color: C.saffron}}>LESSON {i + 1}</div>
              <div style={{fontFamily: F.deva, fontSize: 42, color: '#fff', lineHeight: 1.2, marginTop: 6}}>{ls.a}</div>
              <div style={{fontFamily: F.deva, fontSize: 28, color: 'rgba(255,255,255,0.8)', marginTop: 8}}>{ls.b}</div>
            </Glass>
          )}
        </Pop>
      ))}
      <Pop t0={st(34) - 0.12} t1={en(34) + 0.3} dir="l" style={{left: 90, top: 220, width: 560}}>
        {({sheen}) => (
          <Glass sheen={sheen} tint="255,70,80" border="rgba(255,90,100,0.5)" style={{padding: '22px 28px 26px'}}>
            {['NAME', 'LAUNCH DATE', 'PRODUCT'].map((x, i) => {
              const s = STAMPS[i] ?? st(34) + i; const v = ramp(t, s - 0.02, s + 0.12);
              return (
                <div key={x} style={{position: 'relative', marginTop: i ? 18 : 0}}>
                  <div style={{fontFamily: F.bold, fontSize: 20, letterSpacing: 3, color: 'rgba(255,255,255,0.7)'}}>{x}</div>
                  <div style={{height: 40, marginTop: 6, borderRadius: 6, background: '#0b0b10', width: `${[78, 64, 88][i]}%`}} />
                  {v > 0 && <div style={{position: 'absolute', left: 100, top: 8, padding: '2px 18px', border: `5px solid ${C.red}`, borderRadius: 10, color: C.red,
                    fontFamily: F.head, fontSize: 42, letterSpacing: 4, transform: `rotate(${-8 + i * 5}deg) scale(${2.2 - 1.2 * ease(v)})`, opacity: Math.min(1, v * 2),
                    background: 'rgba(20,0,0,0.35)'}}>CLASSIFIED</div>}
                </div>
              );
            })}
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(36, 'comment') - 0.1} t1={en(36) + 0.3} dir="r" style={{left: 1260, top: 250, width: 580}}>
        {({sheen}) => (
          <Glass sheen={sheen} style={{padding: '22px 26px'}}>
            <div style={{fontFamily: F.deva, fontSize: 34, color: '#fff'}}>💬 Comment में अपना guess</div>
            {t >= wt(36, 'pin') - 0.2 && <div style={{fontFamily: F.deva, fontSize: 28, color: C.gold, marginTop: 10}}>📌 सबसे close guess → अगली video में</div>}
          </Glass>
        )}
      </Pop>
      <Pop t0={wt(37, 'subscribe') - 0.6} t1={en(37) + 0.3} dir="u" style={{left: 1320, top: 330, width: 500}}>
        {() => {
          const c = wt(37, 'subscribe'); const click = t >= c + 0.3;
          return (
            <Glass tint={click ? '255,255,255' : '255,59,71'} style={{padding: '22px 26px', textAlign: 'center', border: click ? '1.5px solid rgba(255,255,255,0.4)' : `2px solid ${C.red}`}}>
              <div style={{fontFamily: F.head, fontSize: 46, color: '#fff', letterSpacing: 3}}>{click ? 'SUBSCRIBED ✓' : 'SUBSCRIBE'}</div>
              <div style={{fontFamily: F.deva, fontSize: 26, color: C.gold, marginTop: 4}}>हर Sunday नई video</div>
            </Glass>
          );
        }}
      </Pop>
      {t >= en(39) + 0.1 && <Twinkles seed={9} opacity={ramp(t, en(39) + 0.1, en(39) + 0.6)} />}
      <Pop t0={en(39) + 0.1} t1={DATA.total + 1} dir="s" style={{left: 0, right: 0, top: 320, display: 'flex', justifyContent: 'center'}}>
        {({sheen}) => (
          <Glass sheen={sheen} radius={40} style={{padding: '36px 72px', textAlign: 'center'}}>
            <div style={{fontFamily: F.deva, fontSize: 66, color: '#fff'}}>मिलते हैं अगले Sunday 👋</div>
            <div style={{fontFamily: F.bold, fontSize: 26, color: 'rgba(255,255,255,0.85)', marginTop: 12}}>YouTube @unfilteredavir · Instagram @unfiltered.avir</div>
          </Glass>
        )}
      </Pop>

      {k >= 0 && !(t >= TITLE0 && t < TITLE1) && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, right: 560 * pipAt(t)}}>
        <Captions words={L[k].words} end={en(k)} bottom={letter > 0.5 ? 26 : 52} size={letter > 0.5 ? 40 : 44} /></div>}
      <AbsoluteFill style={{background: '#000', opacity: Math.max(1 - ramp(t, 0, 0.6), ramp(t, DATA.total - 0.6, DATA.total))}} />
    </AbsoluteFill>
  );
};

export const Ep1: React.FC = () => {
  const {t, frame} = useT();
  const v = viewAt(t); const [sx, sy] = shakeAt(t); const g = gradeAt(t);
  const b = brollAt(t); const p = pipAt(t); const full = !!b && !b.pip;
  const pip = p > 0;
  const cam = pip ? 'close' : v.cam;
  const bx = {x: PIP_BOX.x * p, y: PIP_BOX.y * p, w: 1920 + (PIP_BOX.w - 1920) * p}; const bh = bx.w * 9 / 16;
  const plate: React.CSSProperties = pip
    ? {position: 'absolute', left: bx.x, top: bx.y, width: bx.w, height: bh}
    : {position: 'absolute', width: '100%', height: '100%', transform: `scale(${v.z})`, transformOrigin: `${v.ox * 100}% ${v.oy * 100}%`};
  const radius = 22 * p;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {pip && b && <BrollScene b={b} />}
      {pip && !b && <AbsoluteFill style={{background: '#0d0f1c'}} />}
      <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px)`, filter: IP.nofilter && pip ? undefined : g.filter, clipPath: pip && !IP.noclip ? `inset(${bx.y}px ${1920 - bx.x - bx.w}px ${1080 - bx.y - bh}px ${bx.x}px round ${radius}px)` : undefined}}>
        {!full && <Img src={staticFile(`ep1/plates/bg_${cam}.png`)} style={plate} />}
        {LAYERS !== 'nothree' && (
          <ThreeCanvas width={1920} height={1080} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
            <AvirLights night={g.night} warm={1 - 0.3 * g.secret} />
            <AvirLayer t={t} cam={(CAMS as any)[cam]} view={pip ? {z: 1, ox: 0.5, oy: 0.5} : {z: v.z, ox: v.ox, oy: v.oy}} box={pip ? bx : undefined} hidden={full}
              poses={posesAt(t, frame)} face={faceAt(t, frame)} perf={perfAt(t, frame)} lens={LENS} />
          </ThreeCanvas>
        )}
        {!full && <Img src={staticFile(`ep1/plates/fg_${cam}.png`)} style={plate} />}
        {!full && !pip && <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,${0.34 + 0.3 * g.secret}) 100%)`}} />}
      </AbsoluteFill>
      {pip && <div style={{position: 'absolute', left: bx.x, top: bx.y, width: bx.w, height: bh, borderRadius: radius, border: `${3 * p}px solid rgba(255,255,255,${0.8 * p})`,
        boxShadow: `0 20px 50px rgba(0,0,0,${0.5 * p})`}} />}
      {LAYERS !== 'noui' && <Overlays />}
      <Audio src={staticFile('ep1/ep1_mix.wav')} />
    </AbsoluteFill>
  );
};
export {SHOTS};
