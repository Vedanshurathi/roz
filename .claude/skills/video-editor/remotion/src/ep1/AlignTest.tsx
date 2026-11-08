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
        <AvirLayer t={t} cam={(CAMS as any)[cam]} segs={[{clip, start: 0}]} face={{jawOpen: 0.2, mouthSmileLeft: 0.2, mouthSmileRight: 0.2}} nod={0} />
      </ThreeCanvas>
      {cam === 'close' && <Img src={staticFile(`ep1/plates/fg_${cam}.png`)} style={{position: 'absolute', width: '100%', height: '100%'}} />}
    </AbsoluteFill>
  );
};
