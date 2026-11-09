// Reel 2 — clean vertical Avir layer (no UI): the edit (HyperFrames) adds cards, captions and demos on top.
// Improvements over EP001: tighter vertical framing with slow push-ins + word-timed punch-ins, warmer key + stronger rim,
// richer grade, per-line moods (excited hook, surprise on ₹2 लाख, smile on the call to action).
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {makePerf} from '../ep1/perfcore';
import {useT} from '../ep1/ui';
import DATA from './data.json';
import MORPH from './morph.json';
import CAMS from '../ep1/cams.json';

// [smile, browUp, browDown, smirk, frown] per line
const MOOD: Record<number, number[]> = {0: [0.45, 0.35, 0, 0.15, 0], 1: [0.3, 0.15, 0, 0, 0], 2: [0.25, 0.2, 0, 0, 0], 3: [0.35, 0.45, 0, 0, 0],
  4: [0.5, 0.15, 0, 0.25, 0], 5: [0.35, 0.1, 0, 0.1, 0], 6: [0.2, 0.1, 0, 0, 0], 7: [0.6, 0.2, 0, 0.1, 0]};
const GLANCE: Record<number, [number, number]> = {4: [0.45, 0.3]};
export const P = makePerf(DATA, MORPH, {mood: MOOD, glance: GLANCE});
export const REEL2_TOTAL = DATA.total;
const L = P.L;
const wt = (i: number, sub: string) => L[i].words.find((w: any) => w.w.includes(sub))?.t0 ?? L[i].start;
const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
const PUNCH: [number, number, number][] = [[0.3, 1.6, 0.1], [wt(3, '₹2'), 0.9, 0.09], [wt(6, '₹5,000'), 0.9, 0.08], [L[7].start, 2.6, 0.08]];
const LENS = (CAMS as any).close.pos as number[];

export const Reel2Avir: React.FC = () => {
  const {t, frame} = useT();
  const li = Math.max(0, P.lineAt(t)); const ls = L[li].start, le = L[li].start + L[li].dur;
  // shot plan: medium (head to desk, gestures visible) as base; close-ups on reaction beats
  const CLOSE: [number, number][] = [[0, 1.7], [wt(3, '₹2') - 0.1, L[3].start + L[3].dur + 0.2], [wt(6, '₹5,000') - 0.1, L[6].start + L[6].dur + 0.2]];
  const close = CLOSE.some(([a, b]) => t >= a && t < b);
  const cam = close ? 'close' : 'medium';
  const seg = close ? CLOSE.find(([a, b]) => t >= a && t < b)! : [ls, le];
  let z = (close ? 1.02 : 1.14) + 0.06 * ease((t - seg[0]) / Math.max(1, seg[1] - seg[0]));   // slow push-in per shot
  for (const [a, d, kk] of PUNCH) if (!close && t >= a && t < a + d + 0.3) z += kk * ease((t - a) / 0.15) * (1 - ease((t - a - d) / 0.3));
  const fy = close ? 0.4 * 1080 : 0.29 * 1080;
  const w = 607.5 / z, h = 1080 / z, x = 960 - w / 2 + 6 * Math.sin(t * 0.35), y = Math.max(0, Math.min(1080 - h, fy - (close ? 0.4 : 0.27) * h));
  const k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  const face = P.faceAt(t, frame); if (face.jawOpen) face.jawOpen *= 0.8;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: 'contrast(1.12) saturate(1.25) brightness(1.03)'}}>
        <Img src={staticFile(`ep1/plates/bg_${cam}.png`)} style={plate} />
        <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights warm={1.25} />
          <directionalLight position={[-1.0, 2.4, -1.6]} intensity={1.4} color={'#9ef0ff'} />
          <AvirLayer t={t} cam={(CAMS as any)[cam]} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}}
            poses={P.posesAt(t, frame)} face={face} perf={P.perfAt(t, frame)} lens={LENS} />
        </ThreeCanvas>
        <Img src={staticFile(`ep1/plates/fg_${cam}.png`)} style={plate} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.42) 100%)'}} />
    </AbsoluteFill>
  );
};
