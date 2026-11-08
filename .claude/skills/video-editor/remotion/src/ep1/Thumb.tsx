// EP001 thumbnail (1280×720): Avir close-up with the "secret" gesture, Diwali bokeh, 3-word hook + CLASSIFIED stamp.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from './Avir';
import {C, F} from './ui';
import CAMS from './cams.json';

export const Thumb: React.FC<{clip: string; at: number}> = ({clip, at}) => {
  const z = 1.12, ox = 0.0, oy = 0.42;
  const plate: React.CSSProperties = {position: 'absolute', width: '100%', height: '100%', transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%`};
  const cam = (CAMS as any).close;
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: 'contrast(1.12) saturate(1.25) brightness(1.04)'}}>
        <Img src={staticFile('ep1/plates/bg_close.png')} style={plate} />
        <ThreeCanvas width={1280} height={720} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights />
          <AvirLayer t={at} cam={cam} view={{z, ox, oy}} poses={[{name: clip, time: at, w: 1}]}
            face={{mouthSmileLeft: 0.85, mouthSmileRight: 0.5, jawOpen: 0.06, cheekSquintLeft: 0.55, cheekSquintRight: 0.3, browInnerUp: 0.3, browOuterUpLeft: 0.55, browOuterUpRight: 0.2, eyeSquintLeft: 0.2, eyeSquintRight: 0.15}}
            perf={{nod: 0, tilt: 0.06, turn: 0, lean: 0, look: [0, 0], headAim: 0.6}} lens={cam.pos} />
        </ThreeCanvas>
        <Img src={staticFile('ep1/plates/fg_close.png')} style={plate} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(5,6,14,0.92) 0%, rgba(5,6,14,0.7) 38%, rgba(5,6,14,0) 62%)'}} />
      <div style={{position: 'absolute', left: 54, top: 70, width: 700}}>
        <div style={{fontFamily: F.deva, fontSize: 88, color: '#fff', lineHeight: 1.05, textShadow: '0 6px 24px rgba(0,0,0,0.7)'}}>मेरा</div>
        <div style={{fontFamily: F.head, fontSize: 112, lineHeight: 0.98, color: C.gold, textShadow: '0 6px 24px rgba(0,0,0,0.7)'}}>SECRET</div>
        <div style={{fontFamily: F.head, fontSize: 112, lineHeight: 0.98, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,0.7)'}}>STARTUP</div>
        <div style={{display: 'inline-block', marginTop: 30, padding: '6px 26px', border: `8px solid ${C.red}`, borderRadius: 14, color: C.red, fontFamily: F.head, fontSize: 70,
          letterSpacing: 5, transform: 'rotate(-7deg)', background: 'rgba(20,0,0,0.55)', boxShadow: '0 0 30px rgba(255,59,71,0.45)'}}>CLASSIFIED</div>
      </div>
      <div style={{position: 'absolute', right: 26, top: 22, padding: '8px 18px', borderRadius: 999, background: 'rgba(255,159,28,0.92)', fontFamily: F.head, fontSize: 30, color: '#1a0f00'}}>🪔 DIWALI SPECIAL</div>
    </AbsoluteFill>
  );
};
