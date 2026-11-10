// Reel 3 cover v2 (9:16): "₹500 का AD — सिर्फ़ 2 मिनट में!" Speed hook, kept true: the local AI really made the poster
// (83.8 s) and the voice (4.1 s) in the recording, ~1:28 in total. No earnings promise (the reel says ₹5,000 is an example).
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {F} from '../ep1/ui';
import CAMS from '../ep1/cams.json';

// excited / "wow, that fast?!" face
const FACE = {mouthSmileLeft: 1.0, mouthSmileRight: 0.95, cheekSquintLeft: 0.6, cheekSquintRight: 0.55, jawOpen: 0.28, mouthUpperUpLeft: 0.2, mouthUpperUpRight: 0.2,
  browInnerUp: 0.5, browOuterUpLeft: 0.85, browOuterUpRight: 0.75, eyeWideLeft: 0.35, eyeWideRight: 0.35};
const Big: React.FC<{children: React.ReactNode; size: number; color?: string; style?: React.CSSProperties}> = ({children, size, color = '#fff', style}) => (
  <div style={{fontFamily: F.head, fontSize: size, lineHeight: 0.95, color, WebkitTextStroke: '7px #0d0904', paintOrder: 'stroke fill',
    textShadow: '0 10px 0 #0d0904, 0 16px 40px rgba(0,0,0,0.7)', ...style}}>{children}</div>
);

export const Reel3Cover: React.FC = () => {
  const z = 1.3, w = 607.5 / z, h = 1080 / z, x = 960 - w / 2 + 70, y = Math.max(0, 0.29 * 1080 - 0.36 * h), k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  const cam = (CAMS as any).medium;
  return (
    <AbsoluteFill style={{background: '#0b0807', overflow: 'hidden'}}>
      <AbsoluteFill>
        <Img src={staticFile('reel3/plates/bg_medium.png')} style={plate} />
        <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
          <AvirLights premium />
          <AvirLayer t={3.1} cam={cam} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}} poses={[{name: 'SitTalkBoth', time: 3.1, w: 1}]}
            face={FACE} perf={{nod: 0, tilt: -0.06, turn: -0.05, lean: 0.03, look: [0, 0], headAim: 0.75}} lens={(CAMS as any).close.pos} />
        </ThreeCanvas>
        <Img src={staticFile('reel3/plates/fg_medium.png')} style={plate} />
      </AbsoluteFill>
      {/* money-gold glow behind the headline, darker bottom for the stickers */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 17%, rgba(255,196,40,0.38) 0%, rgba(255,196,40,0) 45%)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,8,7,0.9) 0%, rgba(11,8,7,0.45) 26%, rgba(11,8,7,0) 40%, rgba(11,8,7,0) 60%, rgba(11,8,7,0.85) 100%)'}} />

      {/* headline kept inside the 3:4 profile-grid crop (y 240-1680) */}
      <div style={{position: 'absolute', top: 245, left: 0, right: 0, textAlign: 'center', whiteSpace: 'nowrap'}}>
        <Big size={200} color={'#FFD24A'} style={{display: 'inline-block'}}>₹500</Big>
        <Big size={128} style={{display: 'inline-block', fontFamily: F.deva, marginLeft: 24}}>का AD</Big>
      </div>
      <div style={{position: 'absolute', left: -40, right: -40, top: 470, transform: 'rotate(-3deg)', background: '#1FB45A', padding: '10px 0 18px',
        textAlign: 'center', borderTop: '7px solid #0d0904', borderBottom: '7px solid #0d0904', boxShadow: '0 0 70px rgba(31,180,90,0.6), 0 20px 40px rgba(0,0,0,0.5)'}}>
        <div style={{fontFamily: F.deva, fontSize: 96, color: '#fff', WebkitTextStroke: '4px #0d0904', paintOrder: 'stroke fill', lineHeight: 1.1}}>सिर्फ़ 2 मिनट में! ⚡</div>
      </div>

      {/* the real stopwatch number from the recording: 83.8 s image + 4.1 s voice */}
      <div style={{position: 'absolute', left: 50, top: 1150, transform: 'rotate(-6deg)', padding: '14px 26px 18px', borderRadius: 26, background: '#0d0904',
        border: '6px solid #FFD24A', boxShadow: '0 0 50px rgba(255,210,74,0.55)', textAlign: 'center'}}>
        <div style={{fontSize: 70, lineHeight: 1}}>⏱️</div>
        <div style={{fontFamily: F.head, fontSize: 96, color: '#FFD24A', lineHeight: 1}}>1:28</div>
        <div style={{fontFamily: F.bold, fontSize: 26, color: '#fff', marginTop: 6}}>poster + voice</div>
      </div>
      <div style={{position: 'absolute', right: 40, top: 1060, width: 340, transform: 'rotate(6deg)', borderRadius: 18, overflow: 'hidden',
        border: '8px solid #fff', boxShadow: '0 30px 70px rgba(0,0,0,0.7)'}}>
        <Img src={staticFile('reel3/poster.png')} style={{width: '100%', display: 'block'}} />
      </div>
      <div style={{position: 'absolute', left: 60, top: 1450, transform: 'rotate(-4deg)', padding: '10px 24px', borderRadius: 18, background: '#E5522B',
        border: '5px solid #0d0904', fontFamily: F.head, fontSize: 46, color: '#fff'}}>FREE AI 🤯</div>
      <div style={{position: 'absolute', left: 40, bottom: 34, padding: '8px 18px', borderRadius: 999, background: 'rgba(10,8,7,0.6)', border: '1px solid rgba(255,255,255,0.25)',
        fontFamily: F.bold, fontSize: 24, color: 'rgba(255,255,255,0.9)'}}>AI-generated virtual creator · demo ad for a fictional shop</div>
    </AbsoluteFill>
  );
};
