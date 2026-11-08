// Alignment check: three.js Avir between the Cycles background and foreground plates (compare with the Cycles reference).
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from './Avir';
import CAMS from './cams.json';

export const AlignTest: React.FC<{cam: 'close' | 'medium'; clip: string; at: number}> = ({cam, clip, at}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = at + frame / fps;
  return (
    <AbsoluteFill>
      <Img src={staticFile(`ep1/plates/bg_${cam}.png`)} style={{position: 'absolute', width: '100%', height: '100%'}} />
      <ThreeCanvas width={width} height={height} gl={{antialias: true, alpha: true}}>
        <AvirLights />
        <AvirLayer t={t} cam={(CAMS as any)[cam]} view={{z: 1, ox: 0.5, oy: 0.5}} poses={[{name: clip, time: t % 4, w: 1}]} face={{jawOpen: 0.2}}
          perf={{nod: 0, tilt: 0, turn: 0, lean: 0, look: [0, 0], headAim: 0.45}} lens={(CAMS as any)[cam].pos} />
      </ThreeCanvas>
      {cam === 'close' && <Img src={staticFile(`ep1/plates/fg_${cam}.png`)} style={{position: 'absolute', width: '100%', height: '100%'}} />}
    </AbsoluteFill>
  );
};
