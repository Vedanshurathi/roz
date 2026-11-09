// Reel 3 ("₹500 का AD") — clean vertical Avir layer in the premium studio (walnut slat wall, warm practicals).
// The edit (HyperFrames) adds the shop scene, the real screen recording, cards and captions on top.
// Acting: per-line moods, a long look at the monitor while he "asks the AI", close-ups on the punchlines,
// talking clips only (no pointing), premium warm lights. No CSS filter/overlay on the WebGL layer (that forces a slow
// compositing path in software GL): the grade + vignette are applied afterwards with FFmpeg (see reel3_finish.sh).
import React from 'react';
import {AbsoluteFill, Img, getInputProps, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {makePerf} from '../ep1/perfcore';
import {useT} from '../ep1/ui';
import DATA_IG from './data.json';
import MORPH_IG from './morph.json';
import DATA_YT from './data_yt.json';
import MORPH_YT from './morph_yt.json';
import CAMS from '../ep1/cams.json';

// [smile, browUp, browDown, smirk, frown] per line
const MOOD: Record<number, number[]> = {
  0: [0.05, 0.75, 0, 0.1, 0],      // "₹500 में ad?" — disbelief
  1: [0.4, 0.25, 0, 0.55, 0],      // visiting card joke — smirk
  2: [0.5, 0.35, 0, 0.1, 0],       // challenge — excited
  3: [0.3, 0.15, 0, 0.1, 0], 4: [0.6, 0.55, 0, 0, 0],   // "और ये देखो!" — impressed
  5: [0.3, 0.2, 0, 0.1, 0], 6: [0.6, 0.2, 0, 0.2, 0],
  7: [0.3, 0.1, 0.05, 0, 0],       // math + disclaimer — calmer
  8: [0.45, 0.3, 0, 0.35, 0],      // playful question
  9: [0.6, 0.15, 0, 0.1, 0],
};
const GLANCE: Record<number, [number, number]> = {3: [-0.5, 0.25], 5: [-0.45, 0.2]};
const VARIANT = (getInputProps() as any).variant === 'yt' ? 'yt' : 'ig';
const P = makePerf(VARIANT === 'yt' ? DATA_YT : DATA_IG, VARIANT === 'yt' ? MORPH_YT : MORPH_IG, {mood: MOOD, glance: GLANCE});
export const REEL3_TOTAL = Math.max(DATA_IG.total, DATA_YT.total);
const L = P.L;
const wt = (i: number, sub: string) => L[i].words.find((w: any) => w.w.includes(sub))?.t0 ?? L[i].start;
const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const LENS = (CAMS as any).close.pos as number[];
const end = (i: number) => L[i].start + L[i].dur;
// close-ups: the ₹500 reaction, the visiting-card punchline, the question to viewers
const CLOSE: [number, number][] = [[L[0].start - 0.3, end(0) + 0.15], [wt(1, 'विज़िटिंग') - 0.25, end(1) + 0.4], [L[8].start - 0.1, end(8) + 0.15]];
// looks at the monitor (camera-left) while typing to the AI: from the end of the challenge line to the start of line 4
const LOOKY = (getInputProps() as any).ly ?? 0.0;
const MON: [number, number][] = [[end(2) - 0.2, L[4].start - 0.1], [L[5].start + 0.2, end(5) - 0.6]];

export const Reel3Avir: React.FC = () => {
  const {t, frame} = useT();
  const li = Math.max(0, P.lineAt(t)); const ls = L[li].start, le = end(li);
  const ci = CLOSE.findIndex(([a, b]) => t >= a && t < b); const close = ci >= 0;
  const cam = close ? 'close' : 'medium';
  const seg = close ? CLOSE[ci] : [ls, le];
  const MZ = (getInputProps() as any).mz ?? 1.4;
  const z = (close ? 1.04 : MZ) + 0.05 * ease((t - seg[0]) / Math.max(1, seg[1] - seg[0]));
  const fy = close ? 0.4 * 1080 : 0.29 * 1080;
  const w = 607.5 / z, h = 1080 / z, x = 960 - w / 2 + 5 * Math.sin(t * 0.33), y = Math.max(0, Math.min(1080 - h, fy - (close ? 0.4 : 0.27) * h));
  const k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  const face = P.faceAt(t, frame); if (face.jawOpen) face.jawOpen *= 0.82;
  const perf = P.perfAt(t, frame);
  let m = 0; for (const [a, b] of MON) m = Math.max(m, smooth((t - a) / 0.35) * (1 - smooth((t - b) / 0.35)));
  if (m > 0) { perf.turn += -0.3 * m; perf.look = [perf.look[0] * (1 - m) - 0.45 * m, perf.look[1] * (1 - m) + LOOKY * m]; }
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <AbsoluteFill>
        <Img src={staticFile(`reel3/plates/bg_${cam}.png`)} style={plate} />
        <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights warm={1.0} premium />
          <AvirLayer t={t} cam={(CAMS as any)[cam]} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}}
            poses={P.posesAt(t, frame)} face={face} perf={perf} lens={LENS} />
        </ThreeCanvas>
        <Img src={staticFile(`reel3/plates/fg_${cam}.png`)} style={plate} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
