// Reel 4 ("ये पूरी reel Claude ने edit की है") — Avir's facecam for the dark/orange motion-graphics reel.
// 1100x940 (shown at 550x470 in the HyperFrames edit). Bust framing (the seated rig, so no desk or legs in view) over the
// same warm radial background as the facecam card, with an orange rim from the scene glow. Graphics/captions live in
// HyperFrames (content-studio/host3d/reel4_edit.py). Props: zoom (z), face height (fy), look ('lite' default).
import React from 'react';
import {AbsoluteFill, getInputProps} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {makePerf} from '../ep1/perfcore';
import {useT} from '../ep1/ui';
import DATA from './data.json';
import MORPH from './morph.json';
import CAMS from '../ep1/cams.json';

// [smile, browUp, browDown, smirk, frown] per line
const MOOD: Record<number, number[]> = {
  0: [0.45, 0.6, 0, 0.3, 0],   // hook — proud reveal
  1: [0.25, 0.2, 0, 0.45, 0],  // "ना Premiere, ना CapCut" — playful smirk
  2: [0.55, 0.45, 0, 0.1, 0],  // "बस एक master prompt"
  3: [0.3, 0.2, 0, 0.1, 0], 4: [0.45, 0.3, 0, 0.1, 0], 5: [0.55, 0.4, 0, 0.1, 0],
  6: [0.6, 0.5, 0, 0.2, 0],    // free
  7: [0.4, 0.2, 0, 0.1, 0], 8: [0.45, 0.6, 0, 0.3, 0], 9: [0.65, 0.3, 0, 0.1, 0],
};
const P = makePerf(DATA as any, MORPH as any, {mood: MOOD, glance: {}});
export const REEL4_TOTAL = (DATA as any).total as number;
const W = 1100, H = 940;
const LENS = (CAMS as any).close.pos as number[];

export const Reel4Avir: React.FC = () => {
  const {t, frame} = useT();
  const ip = getInputProps() as any;
  // window into the 1920x1080 close-cam frame with the canvas aspect; slow drift + punch-ins come from the edit
  const z = ip.z ?? 1.25, fy = ip.fy ?? 0.42;
  const w = 1920 / z * 0.5, h = w * H / W;
  const x = 960 - w / 2 + 6 * Math.sin(t * 0.31), y = Math.max(0, Math.min(1080 - h, fy * 1080 - 0.45 * h));
  const face = P.faceAt(t, frame); if (face.jawOpen) face.jawOpen *= 0.85;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 30%, #3a2418, #120c0a 75%)', overflow: 'hidden'}}>
      <ThreeCanvas width={W} height={H} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
        <AvirLights warm={1.15} premium gain={ip.gain ?? 1.0} />
        <AvirLayer t={t} cam={(CAMS as any).close} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}}
          poses={P.posesAt(t, frame)} face={face} perf={P.perfAt(t, frame)} lens={LENS} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
