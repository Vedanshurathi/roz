// Speaking test (not an episode): Avir in the premium studio with the 'real' look and lip-sync v2.
// Render with --props='{"look":"real"}'. Medium chest-up shot, close-up for the last line; grade is applied in FFmpeg.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {makePerf} from '../ep1/perfcore';
import {useT} from '../ep1/ui';
import DATA from './data.json';
import MORPH from './morph.json';
import CAMS from '../ep1/cams.json';

// [smile, browUp, browDown, smirk, frown]
const MOOD: Record<number, number[]> = {0: [0.6, 0.3, 0, 0.1, 0], 1: [0.3, 0.35, 0, 0.25, 0], 2: [0.65, 0.4, 0, 0.3, 0]};
const P = makePerf(DATA, MORPH, {mood: MOOD});
export const SPEAK_TOTAL = DATA.total;
const L = P.L;
const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
const LENS = (CAMS as any).close.pos as number[];

export const SpeakTest: React.FC = () => {
  const {t, frame} = useT();
  const close = t >= L[2].start - 0.25;
  const cam = close ? 'close' : 'medium';
  const z = (close ? 1.02 : 1.38) + 0.06 * ease(close ? (t - L[2].start) / 3 : t / 8);
  const fy = close ? 0.4 * 1080 : 0.29 * 1080;
  const w = 607.5 / z, h = 1080 / z, x = 960 - w / 2 + 4 * Math.sin(t * 0.33), y = Math.max(0, Math.min(1080 - h, fy - (close ? 0.42 : 0.27) * h));
  const k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  const face = P.faceAt(t, frame); if (face.jawOpen) face.jawOpen *= 0.85;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <Img src={staticFile(`reel3/plates/bg_${cam}.png`)} style={plate} />
      <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
        <AvirLights warm={1.0} premium />
        <AvirLayer t={t} cam={(CAMS as any)[cam]} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}}
          poses={P.posesAt(t, frame)} face={face} perf={P.perfAt(t, frame)} lens={LENS} />
      </ThreeCanvas>
      <Img src={staticFile(`reel3/plates/fg_${cam}.png`)} style={plate} />
    </AbsoluteFill>
  );
};
