// EP001 thumbnails (1280×720). Variant "startup": the secret-startup promise. Variant "news": the ₹2 lakh fellowship.
// Rule: Avir big and recognisable, 2–3 words max, one strong colour accent, nothing covering his face.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from './Avir';
import {C, F} from './ui';
import CAMS from './cams.json';

type V = 'startup' | 'news' | 'v1';
export const Thumb: React.FC<{clip: string; at: number; variant?: V}> = ({clip, at, variant = 'startup'}) => {
  const big = variant !== 'v1';
  const z = big ? 1.42 : 1.12, ox = big ? 0.12 : 0.0, oy = big ? 0.33 : 0.42;
  const plate: React.CSSProperties = {position: 'absolute', width: '100%', height: '100%', transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%`};
  const cam = (CAMS as any).close;
  const face = variant === 'news'
    ? {jawOpen: 0.12, mouthSmileLeft: 0.45, mouthSmileRight: 0.45, cheekSquintLeft: 0.3, cheekSquintRight: 0.3, browInnerUp: 0.7, browOuterUpLeft: 0.75, browOuterUpRight: 0.75, eyeWideLeft: 0.4, eyeWideRight: 0.4}
    : {mouthSmileLeft: 0.85, mouthSmileRight: 0.4, jawOpen: 0.05, cheekSquintLeft: 0.55, cheekSquintRight: 0.3, browInnerUp: 0.2, browOuterUpLeft: 0.7, browOuterUpRight: 0.05,
      browDownRight: 0.25, eyeSquintLeft: 0.25, eyeSquintRight: 0.35};
  const shade = 'linear-gradient(90deg, rgba(5,6,14,0.94) 0%, rgba(5,6,14,0.78) 34%, rgba(5,6,14,0) 58%)';
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: 'contrast(1.14) saturate(1.28) brightness(1.06)'}}>
        <Img src={staticFile('ep1/plates/bg_close.png')} style={plate} />
        <ThreeCanvas width={1280} height={720} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights />
          <AvirLayer t={at} cam={cam} view={{z, ox, oy}} poses={[{name: clip, time: at, w: 1}]} face={face}
            perf={{nod: 0, tilt: variant === 'news' ? -0.05 : 0.07, turn: 0, lean: 0, look: [0, 0], headAim: 0.7}} lens={cam.pos} />
        </ThreeCanvas>
        <Img src={staticFile('ep1/plates/fg_close.png')} style={plate} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: shade}} />
      {variant === 'news' ? (
        <div style={{position: 'absolute', left: 50, top: 92, width: 640}}>
          <div style={{fontFamily: F.head, fontSize: 150, lineHeight: 0.95, color: C.gold, textShadow: '0 8px 30px rgba(0,0,0,0.8)'}}>₹2 लाख</div>
          <div style={{fontFamily: F.deva, fontSize: 64, color: C.gold, lineHeight: 1.1, textShadow: '0 6px 24px rgba(0,0,0,0.8)'}}>तक</div>
          <div style={{fontFamily: F.deva, fontSize: 84, lineHeight: 1.1, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,0.8)', marginTop: 6}}>AI Fellowship</div>
          <div style={{display: 'inline-block', marginTop: 26, padding: '8px 22px', borderRadius: 14, background: C.saffron, fontFamily: F.head, fontSize: 40, color: '#1a0f00'}}>STUDENTS 👀</div>
        </div>
      ) : (
        <div style={{position: 'absolute', left: 50, top: 110, width: 640}}>
          <div style={{fontFamily: F.deva, fontSize: 96, color: '#fff', lineHeight: 1.0, textShadow: '0 6px 24px rgba(0,0,0,0.8)'}}>मेरा</div>
          <div style={{fontFamily: F.head, fontSize: 132, lineHeight: 1.0, color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,0.8)'}}>STARTUP</div>
          <div style={{display: 'inline-block', marginTop: 34, padding: '6px 28px', border: `9px solid ${C.red}`, borderRadius: 14, color: C.red, fontFamily: F.head, fontSize: 82,
            letterSpacing: 5, transform: 'rotate(-7deg)', background: 'rgba(20,0,0,0.6)', boxShadow: '0 0 34px rgba(255,59,71,0.55)'}}>CLASSIFIED</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
