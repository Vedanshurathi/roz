// EP002 thumbnail (1280x720): Avir on the jhoola at his villa, big "AI NEWS — मेरे घर से!", the three headlines as chips.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from '../ep1/Avir';
import {F} from '../ep1/ui';
import VCAMS from './vcams.json';

const FACE = {mouthSmileLeft: 0.85, mouthSmileRight: 0.75, cheekSquintLeft: 0.45, cheekSquintRight: 0.4, jawOpen: 0.2, browInnerUp: 0.45, browOuterUpLeft: 0.7, browOuterUpRight: 0.6, eyeWideLeft: 0.25, eyeWideRight: 0.25};
const Big: React.FC<{children: React.ReactNode; size: number; color?: string; style?: React.CSSProperties}> = ({children, size, color = '#fff', style}) => (
  <div style={{fontFamily: F.head, fontSize: size, lineHeight: 0.95, color, WebkitTextStroke: '6px #120b05', paintOrder: 'stroke fill', textShadow: '0 8px 0 #120b05, 0 12px 34px rgba(0,0,0,0.7)', ...style}}>{children}</div>
);
const Chip: React.FC<{children: React.ReactNode; bg: string}> = ({children, bg}) => (
  <div style={{display: 'inline-block', padding: '10px 20px', borderRadius: 14, background: bg, fontFamily: F.head, fontSize: 30, color: '#fff', border: '4px solid #120b05', marginRight: 12, marginTop: 12}}>{children}</div>
);

export const Ep2Thumb: React.FC = () => {
  const cam = (VCAMS as any).jho_close; const z = 1.0, ox = 0.5, oy = 0.5;
  const plate: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${z})`, transformOrigin: `${ox * 100}% ${oy * 100}%`};
  return (
    <AbsoluteFill style={{background: '#0b0807', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'scale(0.6667)', transformOrigin: '0 0'}}>
        <div style={{position: 'absolute', left: 330, top: 0, width: 1920, height: 1080}}>
          <Img src={staticFile('ep2/plates/bg_jho_close.png')} style={plate} />
          <ThreeCanvas width={1920} height={1080} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
            <AvirLights premium gain={0.85} cool={0.6} warm={1.25} />
            <AvirLayer t={3.1} cam={cam} view={{z, ox, oy}} poses={[{name: 'SitTalkBoth', time: 3.1, w: 1}]} face={FACE}
              perf={{nod: 0, tilt: -0.06, turn: 0.04, lean: 0.03, look: [0, 0], headAim: 0.75}} lens={cam.pos} />
          </ThreeCanvas>
        </div>
      </div>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(11,8,7,0.92) 0%, rgba(11,8,7,0.75) 34%, rgba(11,8,7,0) 58%)'}} />
      <div style={{position: 'absolute', left: 46, top: 52}}>
        <div style={{display: 'inline-block', padding: '6px 18px', borderRadius: 10, background: '#fff', color: '#111', fontFamily: F.head, fontSize: 30, letterSpacing: 4}}>SUNDAY · EP 02</div>
        <Big size={128} color={'#FFD24A'} style={{marginTop: 18}}>AI NEWS</Big>
        <Big size={92} style={{fontFamily: F.deva, marginTop: 4}}>मेरे घर से! 🏡</Big>
        <div style={{marginTop: 16, width: 640}}><Chip bg={'#1a73e8'}>Gemini 4 Carbon</Chip><Chip bg={'#c2552d'}>Claude Fable 5.2</Chip><Chip bg={'#1FB45A'}>₹1 लाख Hackathon</Chip></div>
      </div>
      <div style={{position: 'absolute', right: 26, bottom: 22, padding: '6px 14px', borderRadius: 999, background: 'rgba(10,8,7,0.6)', fontFamily: F.bold, fontSize: 18, color: 'rgba(255,255,255,0.9)'}}>AI-generated virtual creator</div>
    </AbsoluteFill>
  );
};
