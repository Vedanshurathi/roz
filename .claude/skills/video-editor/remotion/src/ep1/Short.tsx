// Vertical (9:16) Shorts/Reels cut from EP001, rendered natively: same acting, voice and mix as the episode, but a
// vertical window of the close camera, bigger captions, a hook line and one info card at a time.
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from './Avir';
import {C, Captions, F, Glass, Pop, clamp01, ease, ramp, useT} from './ui';
import {L, en, faceAt, lineAt, perfAt, posesAt, st} from './perf';
import {Broll, BrollScene} from './screens';
import DATA from './data.json';
import CAMS from './cams.json';

const wt = (i: number, sub: string, nth = 0) => L[i].words.filter((w) => w.w.toLowerCase().includes(sub.toLowerCase()))[nth]?.t0 ?? L[i].start;
export type ShortKind = 'startup' | 'fellowship' | 'founder';
export const SHORTS: Record<ShortKind, {t0: number; t1: number; hook: [string, string]}> = {
  startup: {t0: st(33) - 0.25, t1: en(36) + 0.45, hook: ['मेरा', 'STARTUP 🔒']},
  fellowship: {t0: st(20) - 0.25, t1: en(21) + 0.45, hook: ['Students 👀', '₹2 लाख तक']},
  founder: {t0: st(22) - 0.3, t1: en(25) + 0.45, hook: ['Founder Life', 'का सच 👇']},
};
const STAMPS = DATA.cue.classified as number[];
const BROLL = DATA.cue.broll as Broll[];
const LENS = (CAMS as any).medium.pos as number[];

const BottomCard: React.FC<{t0: number; t1: number; children: (sheen: number) => React.ReactNode; top?: number}> = ({t0, t1, children, top = 1150}) => (
  <Pop t0={t0} t1={t1} dir="u" style={{left: 70, right: 70, top}}>{({sheen}) => <>{children(sheen)}</>}</Pop>
);

/** Outer wrapper: shifts the timeline so every overlay (which reads episode time) lines up; audio is cut from the mix. */
export const Short: React.FC<{kind: ShortKind}> = ({kind}) => {
  const S = SHORTS[kind]; const F0 = Math.round(S.t0 * 24); const n = Math.round((S.t1 - S.t0) * 24);
  const vol = (f: number) => interpolate(f, [0, 4, n - 12, n], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Sequence from={-F0} durationInFrames={F0 + n + 24}><ShortInner kind={kind} /></Sequence>
      <Audio src={staticFile('ep1/ep1_mix.wav')} startFrom={F0} endAt={F0 + n} volume={vol} />
    </AbsoluteFill>
  );
};

const ShortInner: React.FC<{kind: ShortKind}> = ({kind}) => {
  const {frame, fps} = useT();
  const S = SHORTS[kind];
  const t = frame / fps; const gf = frame;   // episode time (the Sequence above shifts the frame)
  const dur = S.t1 - S.t0; const p = clamp01((t - S.t0) / dur);
  // vertical window of the close camera, slow push-in + punches on the stamps
  let z = 1.12 + 0.1 * ease(p);
  for (const s of STAMPS) if (t >= s && t < s + 0.5) z += 0.06 * Math.exp(-(t - s) * 9);
  const w = 607.5 / z, h = 1080 / z, x = 960 - w / 2, y = Math.max(0, Math.min(1080 - h, 313 - 0.3 * h));
  const k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  let sx = 0; for (const s of STAMPS) if (t >= s && t < s + 0.3) sx += 10 * Math.exp(-(t - s) * 14) * Math.sin(t * 95);
  const secret = kind === 'startup' ? ramp(t, st(33), st(33) + 0.3) * (1 - ramp(t, en(34), en(34) + 0.6)) : 0;
  const night = kind === 'founder' ? 0 : 0;
  const li = Math.max(0, lineAt(t));
  const broll = kind === 'founder' ? BROLL.find((b) => (b.kind === 'expect' || b.kind === 'reality') && t >= b.t0 && t < b.t1) : undefined;
  const cardUp = (kind === 'fellowship') || (kind === 'startup' && ((t >= st(34) - 0.12 && t < en(34) + 0.3) || t >= wt(36, 'comment') - 0.1)) || !!broll;
  const capBottom = cardUp ? 1920 - 1150 + 22 : 470;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translateX(${sx}px)`, filter: `contrast(${1.08 + 0.08 * secret}) saturate(${1.15 - 0.3 * secret}) brightness(${1 - 0.1 * secret})`}}>
        <Img src={staticFile('ep1/plates/bg_medium.png')} style={plate} />
        <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights night={night} warm={1 - 0.3 * secret} />
          <AvirLayer t={t} cam={(CAMS as any).medium} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}}
            poses={posesAt(t, gf)} face={faceAt(t, gf)} perf={perfAt(t, gf)} lens={LENS} />
        </ThreeCanvas>
        <Img src={staticFile('ep1/plates/fg_medium.png')} style={plate} />
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 38%, rgba(0,0,0,0) 45%, rgba(0,0,0,${0.4 + 0.3 * secret}) 100%)`}} />
      </AbsoluteFill>

      {/* disclosure + brand */}
      <div style={{position: 'absolute', left: 40, top: 120, padding: '7px 16px', borderRadius: 999, background: 'rgba(10,12,24,0.5)', border: '1px solid rgba(255,255,255,0.22)',
        fontFamily: F.bold, fontSize: 22, color: 'rgba(255,255,255,0.9)'}}><span style={{color: C.cyan}}>●</span>&nbsp; AI-generated virtual creator</div>

      {/* hook (first 2.6 s) */}
      <Pop t0={S.t0} t1={S.t0 + 2.6} dir="s" style={{left: 0, right: 0, top: 230, textAlign: 'center'}}>
        {() => <>
          <div style={{fontFamily: F.deva, fontSize: 92, color: '#fff', lineHeight: 1.05, textShadow: '0 6px 26px rgba(0,0,0,0.85)'}}>{S.hook[0]}</div>
          <div style={{fontFamily: F.head, fontSize: 120, color: C.gold, lineHeight: 1.0, textShadow: '0 6px 26px rgba(0,0,0,0.85)'}}>{S.hook[1]}</div>
        </>}
      </Pop>

      {kind === 'startup' && <>
        <BottomCard t0={st(34) - 0.12} t1={en(34) + 0.3}>
          {(sheen) => (
            <Glass sheen={sheen} tint="255,70,80" border="rgba(255,90,100,0.55)" style={{padding: '26px 34px 32px'}}>
              {['NAME', 'LAUNCH DATE', 'PRODUCT'].map((lab, i) => {
                const s = STAMPS[i] ?? st(34) + i; const v = ramp(t, s - 0.02, s + 0.12);
                return (
                  <div key={lab} style={{position: 'relative', marginTop: i ? 22 : 0}}>
                    <div style={{fontFamily: F.bold, fontSize: 28, letterSpacing: 4, color: 'rgba(255,255,255,0.75)'}}>{lab}</div>
                    <div style={{height: 52, marginTop: 8, borderRadius: 8, background: '#0b0b10', width: `${[80, 64, 90][i]}%`}} />
                    {v > 0 && <div style={{position: 'absolute', left: 150, top: 12, padding: '2px 22px', border: `6px solid ${C.red}`, borderRadius: 12, color: C.red, fontFamily: F.head,
                      fontSize: 56, letterSpacing: 4, transform: `rotate(${-8 + i * 5}deg) scale(${2.2 - 1.2 * ease(v)})`, opacity: Math.min(1, v * 2), background: 'rgba(20,0,0,0.4)'}}>CLASSIFIED</div>}
                  </div>
                );
              })}
            </Glass>
          )}
        </BottomCard>
        <BottomCard t0={wt(36, 'comment') - 0.1} t1={S.t1 + 1}>
          {(sheen) => (
            <Glass sheen={sheen} style={{padding: '28px 34px'}}>
              <div style={{fontFamily: F.deva, fontSize: 52, color: '#fff'}}>💬 Comment में अपना guess</div>
              {t >= wt(36, 'pin') - 0.2 && <div style={{fontFamily: F.deva, fontSize: 40, color: C.gold, marginTop: 12}}>📌 सबसे close guess → अगली video में</div>}
            </Glass>
          )}
        </BottomCard>
      </>}

      {kind === 'fellowship' && (
        <BottomCard t0={S.t0 + 0.2} t1={S.t1 + 1}>
          {(sheen) => (
            <Glass sheen={sheen} style={{padding: '28px 36px 30px'}}>
              <div style={{fontFamily: F.bold, fontSize: 26, letterSpacing: 3, color: C.cyan}}>INDIAAI · GOVT. OF INDIA</div>
              <div style={{fontFamily: F.head, fontSize: 54, color: '#fff', lineHeight: 1.1}}>IndiaAI Fellowship 2026–27</div>
              {[[wt(20, 'UG'), '🎓 UG: ₹1 लाख तक'], [wt(20, 'PG'), '🎓 PG: ₹2 लाख तक'], [wt(20, 'last'), '📅 Last date: 30 Nov 2026'], [wt(21, 'portal'), '🔗 fellowship.indiaai.gov.in']].map(([a, s]) => {
                const v = ease(ramp(t, (a as number) - 0.1, (a as number) + 0.3)); if (v <= 0) return null;
                return <div key={s as string} style={{fontFamily: F.deva, fontSize: 44, color: '#fff', marginTop: 14, opacity: v, transform: `translateX(${(1 - v) * 30}px)`}}>{s}</div>;
              })}
              <div style={{fontFamily: F.bold, fontSize: 20, color: 'rgba(255,255,255,0.65)', marginTop: 18}}>Sources: Business Today · EducationPost · Biotecnika · PhD: official portal check करें</div>
            </Glass>
          )}
        </BottomCard>
      )}

      {broll && (
        <div style={{position: 'absolute', left: 90, top: 1150, width: 900, height: 506, borderRadius: 26, overflow: 'hidden', border: '3px solid rgba(255,255,255,0.8)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${900 / 1920})`, transformOrigin: '0 0'}}>
            <BrollScene b={broll} />
          </div>
        </div>
      )}

      {/* captions */}
      <Captions words={L[li].words} end={en(li)} bottom={capBottom} size={60} maxW={980} perGroup={4} />

      {/* end: where to watch the full video */}
      <Pop t0={S.t1 - 2.2} t1={S.t1 + 1} dir="d" style={{left: 0, right: 0, top: 240, display: 'flex', justifyContent: 'center'}}>
        {() => <div style={{padding: '12px 28px', borderRadius: 999, background: C.saffron, fontFamily: F.head, fontSize: 38, color: '#1a0f00'}}>▶ Full video: @unfilteredavir</div>}
      </Pop>
    </AbsoluteFill>
  );
};
