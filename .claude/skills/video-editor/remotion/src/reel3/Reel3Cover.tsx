// Reel 3 cover (9:16): Avir close-up with a "really?!" face, huge "₹500 का AD?", the real poster the local AI made.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {F} from '../ep1/ui';
import CAMS from '../ep1/cams.json';

const FACE = {browInnerUp: 0.75, browOuterUpLeft: 0.9, browOuterUpRight: 0.55, eyeWideLeft: 0.5, eyeWideRight: 0.5,
  mouthSmileLeft: 0.45, mouthSmileRight: 0.15, jawOpen: 0.12, cheekSquintLeft: 0.25};
const Big: React.FC<{children: React.ReactNode; size: number; color?: string; style?: React.CSSProperties}> = ({children, size, color = '#fff', style}) => (
  <div style={{fontFamily: F.head, fontSize: size, lineHeight: 0.95, color, WebkitTextStroke: '7px #120b05', paintOrder: 'stroke fill',
    textShadow: '0 10px 0 #120b05, 0 16px 40px rgba(0,0,0,0.7)', ...style}}>{children}</div>
);

export const Reel3Cover: React.FC = () => {
  const z = 1.32, w = 607.5 / z, h = 1080 / z, x = 960 - w / 2 + 10, y = Math.max(0, 0.29 * 1080 - 0.33 * h), k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  const cam = (CAMS as any).medium;
  return (
    <AbsoluteFill style={{background: '#0b0807', overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: 'contrast(1.1) saturate(1.15) brightness(1.04)'}}>
        <Img src={staticFile('reel3/plates/bg_medium.png')} style={plate} />
        <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights premium />
          <AvirLayer t={2.0} cam={cam} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}} poses={[{name: 'SitTalkBoth', time: 2.0, w: 1}]}
            face={FACE} perf={{nod: 0, tilt: 0.07, turn: 0.03, lean: 0, look: [0, 0], headAim: 0.7}} lens={(CAMS as any).close.pos} />
        </ThreeCanvas>
        <Img src={staticFile('reel3/plates/fg_medium.png')} style={plate} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,8,7,0.92) 0%, rgba(11,8,7,0.5) 24%, rgba(11,8,7,0) 38%, rgba(11,8,7,0) 62%, rgba(11,8,7,0.8) 100%)'}} />
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center'}}>
        <Big size={250} color={'#FFD24A'}>₹500</Big>
        <Big size={120} style={{fontFamily: F.deva, marginTop: 6}}>का AD?</Big>
      </div>
      <div style={{position: 'absolute', left: 40, top: 1180, width: 380, transform: 'rotate(-7deg)', borderRadius: 18, overflow: 'hidden',
        border: '8px solid #fff', boxShadow: '0 30px 70px rgba(0,0,0,0.7)'}}>
        <Img src={staticFile('reel3/poster.png')} style={{width: '100%', display: 'block'}} />
      </div>
      <div style={{position: 'absolute', right: 50, top: 1330, transform: 'rotate(5deg)', padding: '18px 30px', borderRadius: 22, background: '#E5522B',
        border: '6px solid #120b05', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center'}}>
        <div style={{fontFamily: F.head, fontSize: 58, color: '#fff', lineHeight: 1}}>AI ने</div>
        <div style={{fontFamily: F.deva, fontSize: 62, color: '#fff', lineHeight: 1.15}}>बनाया! 🤯</div>
      </div>
      <div style={{position: 'absolute', left: 40, bottom: 34, padding: '8px 18px', borderRadius: 999, background: 'rgba(10,8,7,0.6)', border: '1px solid rgba(255,255,255,0.25)',
        fontFamily: F.bold, fontSize: 24, color: 'rgba(255,255,255,0.9)'}}>AI-generated virtual creator · demo ad for a fictional shop</div>
    </AbsoluteFill>
  );
};
