// EP002 Avir layer (16:9): Avir moves between locations line by line — on the jhoola by the pool (villa), on the living-room
// sofa (villa) and in the studio. Villa plates come from host3d/villa_plates.py (cameras already converted into Avir's
// frame, see vcams.json); studio plates are the premium Reel 3 plates. The edit (HyperFrames) adds browser recordings,
// cards and captions on top of this layer.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {makePerf} from '../ep1/perfcore';
import {useT} from '../ep1/ui';
import DATA from './data.json';
import MORPH from './morph.json';
import VCAMS from './vcams.json';
import CAMS from '../ep1/cams.json';

// [smile, browUp, browDown, smirk, frown] per line
const MOOD: Record<number, number[]> = {
  0: [0.55, 0.35, 0, 0.2, 0], 1: [0.5, 0.4, 0, 0.1, 0], 2: [0.6, 0.15, 0, 0, 0], 3: [0.45, 0.3, 0, 0.15, 0], 4: [0.6, 0.35, 0, 0.1, 0],
  5: [0.45, 0.3, 0, 0.1, 0], 6: [0.3, 0.2, 0, 0, 0], 7: [0.25, 0.15, 0, 0, 0], 8: [0.3, 0.25, 0, 0.25, 0],
  9: [0.4, 0.3, 0, 0.1, 0], 10: [0.3, 0.2, 0, 0, 0], 11: [0.25, 0.15, 0, 0.1, 0],
  12: [0.55, 0.45, 0, 0.1, 0], 13: [0.3, 0.15, 0, 0, 0], 14: [0.55, 0.35, 0, 0.1, 0],
  15: [0.45, 0.15, 0, 0.1, 0], 16: [0.6, 0.35, 0, 0.3, 0], 17: [0.65, 0.2, 0, 0.1, 0],
};
const GLANCE: Record<number, [number, number]> = {1: [0.4, 0.25], 5: [-0.45, 0.2], 8: [0.4, 0.2], 11: [-0.4, 0.25], 13: [0.45, 0.2]};
const P = makePerf(DATA, MORPH, {mood: MOOD, glance: GLANCE});
export const EP2_TOTAL = DATA.total;
const L = P.L as any[];
const LENS_STUDIO = (CAMS as any).close.pos as number[];

type Loc = 'jho' | 'liv' | 'studio';
const LIGHT: Record<Loc, {gain: number; cool: number; warm: number}> = {jho: {gain: 0.8, cool: 0.6, warm: 1.25}, liv: {gain: 0.95, cool: 0, warm: 1.1}, studio: {gain: 1.0, cool: 0, warm: 1.0}};

const shotOf = (i: number) => {
  const l = L[i]; const loc = l.loc as Loc; const close = l.shot === 'close';
  if (loc === 'studio') return {loc, key: close ? 'close' : 'medium', cam: (CAMS as any)[close ? 'close' : 'medium'], plates: 'reel3/plates', lens: LENS_STUDIO};
  const key = `${loc}_${close ? 'close' : 'wide'}`; const cam = (VCAMS as any)[key];
  return {loc, key, cam, plates: 'ep2/plates', lens: cam.pos as number[]};
};

export const Ep2Avir: React.FC = () => {
  const {t, frame} = useT();
  const li = Math.max(0, P.lineAt(t)); const sh = shotOf(li);
  const ls = L[li].start, le = L[li].start + L[li].dur + (L[li].gap ?? 0.4);
  const k = Math.max(0, Math.min(1, (t - ls) / Math.max(1, le - ls)));
  const z = 1.0 + 0.045 * (1 - Math.pow(1 - k, 2));            // slow push-in per line
  const ox = 0.5, oy = sh.key.includes('close') || sh.key === 'close' ? 0.38 : 0.42;
  const plate: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%`};
  const lt = LIGHT[sh.loc];
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <Img src={staticFile(`${sh.plates}/bg_${sh.key}.png`)} style={plate} />
      <ThreeCanvas width={1920} height={1080} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
        <AvirLights premium gain={lt.gain} cool={lt.cool} warm={lt.warm} />
        <AvirLayer t={t} cam={sh.cam} view={{z, ox, oy}} poses={P.posesAt(t, frame)} face={P.faceAt(t, frame)} perf={P.perfAt(t, frame)} lens={sh.lens} />
      </ThreeCanvas>
      <Img src={staticFile(`${sh.plates}/fg_${sh.key}.png`)} style={plate} />
    </AbsoluteFill>
  );
};
