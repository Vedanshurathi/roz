// EP002 thumbnail v2 (1280x720, English only): the two new models as the hook, the ₹1 lakh hackathon as the kicker,
// Avir big on the right with a "wow" face and a strong rim light, dark background from his pool deck.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {F} from '../ep1/ui';
import VCAMS from './vcams.json';

const FACE = {mouthSmileLeft: 0.7, mouthSmileRight: 0.55, jawOpen: 0.32, mouthFunnel: 0.15, browInnerUp: 0.75, browOuterUpLeft: 0.95, browOuterUpRight: 0.85,
  eyeWideLeft: 0.55, eyeWideRight: 0.55, cheekSquintLeft: 0.2};
const Line: React.FC<{children: React.ReactNode; size: number; color: string; glow: string; style?: React.CSSProperties}> = ({children, size, color, glow, style}) => (
  <div style={{fontFamily: F.head, fontSize: size, lineHeight: 0.92, color, letterSpacing: -1, WebkitTextStroke: '5px #07060a', paintOrder: 'stroke fill',
    textShadow: `0 7px 0 #07060a, 0 0 38px ${glow}`, whiteSpace: 'nowrap', ...style}}>{children}</div>
);

export const Ep2Thumb: React.FC = () => {
  const cam = (VCAMS as any).jho_close; const z = 1.0, ox = 0.5, oy = 0.5;
  const plate: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%`,
    filter: 'brightness(0.55) saturate(1.2) blur(2px)'};
  return (
    <AbsoluteFill style={{background: '#07060a', overflow: 'hidden'}}>
      {/* Avir, scaled up and pushed right */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'scale(0.8)', transformOrigin: '0 0'}}>
        <div style={{position: 'absolute', left: 520, top: -40, width: 1920, height: 1080}}>
          <Img src={staticFile('ep2/plates/bg_jho_close.png')} style={plate} />
          <ThreeCanvas width={1920} height={1080} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
            <AvirLights premium gain={1.05} cool={1.0} warm={1.6} />
            <AvirLayer t={2.2} cam={cam} view={{z, ox, oy}} poses={[{name: 'SitTalkBoth', time: 2.2, w: 1}]} face={FACE}
              perf={{nod: 0, tilt: 0.07, turn: -0.06, lean: 0.05, look: [0, 0], headAim: 0.8}} lens={cam.pos} />
          </ThreeCanvas>
        </div>
      </div>
      {/* dark behind the text; blue (Google) glow top-left, orange (Anthropic) glow lower-left */}
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(7,6,10,0.96) 0%, rgba(7,6,10,0.85) 38%, rgba(7,6,10,0.15) 62%, rgba(7,6,10,0) 75%)'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 18% 30%, rgba(40,110,255,0.35) 0%, rgba(40,110,255,0) 40%), radial-gradient(ellipse at 20% 72%, rgba(255,110,40,0.30) 0%, rgba(255,110,40,0) 40%)'}} />
      <div style={{position: 'absolute', left: 44, top: 40}}>
        <div style={{display: 'inline-block', padding: '7px 18px', borderRadius: 10, background: '#FFD24A', color: '#111', fontFamily: F.head, fontSize: 28, letterSpacing: 3}}>THIS WEEK IN AI</div>
        <Line size={112} color={'#7fb2ff'} glow={'rgba(60,130,255,0.85)'} style={{marginTop: 22}}>GEMINI 4</Line>
        <Line size={112} color={'#ffffff'} glow={'rgba(60,130,255,0.6)'}>CARBON</Line>
        <div style={{fontFamily: F.head, fontSize: 54, color: '#FFD24A', margin: '6px 0 2px 6px', textShadow: '0 4px 0 #07060a'}}>+</div>
        <Line size={88} color={'#ffb07a'} glow={'rgba(255,120,50,0.8)'}>CLAUDE FABLE 5.2</Line>
      </div>
      <div style={{position: 'absolute', left: 44, bottom: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px 14px', borderRadius: 18, background: '#1FB45A',
        border: '5px solid #07060a', boxShadow: '0 0 40px rgba(31,180,90,0.6)', transform: 'rotate(-2deg)'}}>
        <span style={{fontSize: 46}}>🏆</span>
        <span style={{fontFamily: F.head, fontSize: 44, color: '#fff', WebkitTextStroke: '2px #07060a', paintOrder: 'stroke fill'}}>₹1 LAKH AI HACKATHON</span>
      </div>
      <div style={{position: 'absolute', left: 575, top: 128, padding: '10px 20px', borderRadius: 14, background: '#E5522B', fontFamily: F.head, fontSize: 40, color: '#fff',
        border: '5px solid #07060a', transform: 'rotate(6deg)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>NEW!</div>
      <div style={{position: 'absolute', right: 22, bottom: 18, padding: '5px 12px', borderRadius: 999, background: 'rgba(7,6,10,0.65)', fontFamily: F.bold, fontSize: 16, color: 'rgba(255,255,255,0.85)'}}>AI-generated virtual creator</div>
    </AbsoluteFill>
  );
};
