// "Avir ka ek din" (vertical 1080x1920): Avir moves through his villa line by line: bed (morning), studio desk,
// living-room sofa, jhoola by the pool, studio again (evening), bed (night). Plates from host3d/day_plates.py (portrait
// cameras already converted into Avir's frame → vcams.json). Lesson cards, captions and time-of-day chips come from the
// HyperFrames edit (host3d/din_edit.py). No CSS filter on the WebGL layer; the grade is applied with FFmpeg.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {makePerf} from '../ep1/perfcore';
import {useT} from '../ep1/ui';
import DATA from './data.json';
import MORPH from './morph.json';
import VCAMS from './vcams.json';

// [smile, browUp, browDown, smirk, frown] per line
const MOOD: Record<number, number[]> = {
  0: [0.2, 0.15, 0, 0.25, 0], 1: [0.45, 0.3, 0, 0.1, 0],          // sleepy smirk → lesson
  2: [0.3, 0.35, 0, 0.1, 0], 3: [0.5, 0.25, 0, 0.1, 0],
  4: [0.1, 0.2, 0.15, 0, 0.1], 5: [0.45, 0.3, 0, 0.15, 0],       // low views: thoughtful, then calm
  6: [0.35, 0.3, 0, 0.3, 0], 7: [0.55, 0.3, 0, 0.1, 0],
  8: [0.4, 0.1, 0, 0.1, 0], 9: [0.55, 0.2, 0, 0.1, 0],
  10: [0.45, 0.3, 0, 0.1, 0], 11: [0.55, 0.35, 0, 0.1, 0],
  12: [0.5, 0.25, 0, 0.1, 0], 13: [0.65, 0.4, 0, 0.2, 0],
};
const GLANCE: Record<number, [number, number]> = {2: [-0.4, 0.25], 4: [-0.45, 0.2], 10: [-0.4, 0.2]};
const P = makePerf(DATA as any, MORPH as any, {mood: MOOD, glance: GLANCE});
export const DIN_TOTAL = (DATA as any).total as number;
const L = P.L as any[];

const LIGHT: Record<string, {gain: number; cool: number; warm: number}> = {
  bed: {gain: 0.95, cool: 0.1, warm: 1.15}, night: {gain: 0.6, cool: 0.35, warm: 1.35}, studio: {gain: 1.0, cool: 0, warm: 1.0},
  liv: {gain: 0.95, cool: 0, warm: 1.1}, jho: {gain: 0.8, cool: 0.6, warm: 1.25},
};
const shotOf = (i: number) => {
  const l = L[i]; const key = l.vshot === 'night' ? 'bed_night' : `${l.loc}_${l.vshot}`;
  return {key, cam: (VCAMS as any)[key], light: LIGHT[l.vshot === 'night' ? 'night' : l.loc]};
};

export const DinAvir: React.FC = () => {
  const {t, frame} = useT();
  const li = Math.max(0, P.lineAt(t)); const sh = shotOf(li);
  const ls = L[li].start, le = L[li].start + L[li].dur + (L[li].gap ?? 0.4);
  const k = Math.max(0, Math.min(1, (t - ls) / Math.max(1, le - ls)));
  const z = 1.0 + 0.05 * (1 - Math.pow(1 - k, 2));            // slow push-in per line
  const ox = 0.5, oy = 0.36;
  const plate: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%`};
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <Img src={staticFile(`din/plates/bg_${sh.key}.png`)} style={plate} />
      <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
        <AvirLights premium gain={sh.light.gain} cool={sh.light.cool} warm={sh.light.warm} />
        <AvirLayer t={t} cam={sh.cam} view={{z, ox, oy}} poses={P.posesAt(t, frame)} face={P.faceAt(t, frame)} perf={P.perfAt(t, frame)} lens={sh.cam.pos} />
      </ThreeCanvas>
      <Img src={staticFile(`din/plates/fg_${sh.key}.png`)} style={plate} />
    </AbsoluteFill>
  );
};
