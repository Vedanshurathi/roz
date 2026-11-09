// Bold 9:16 covers for Shorts/Reels: Avir big with an exaggerated expression, one idea, huge text, strong colour.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {AvirLayer, AvirLights} from './Avir';
import {C, F} from './ui';
import CAMS from './cams.json';

type K = 'startup' | 'fellowship' | 'founder';
const FACES: Record<K, Record<string, number>> = {
  startup: {mouthSmileLeft: 0.9, mouthSmileRight: 0.3, cheekSquintLeft: 0.6, browOuterUpLeft: 0.85, browDownRight: 0.45, eyeSquintRight: 0.4, eyeSquintLeft: 0.2},
  fellowship: {jawOpen: 0.2, mouthFunnel: 0.55, mouthPucker: 0.15, browInnerUp: 0.9, browOuterUpLeft: 0.9, browOuterUpRight: 0.9, eyeWideLeft: 0.7, eyeWideRight: 0.7},
  founder: {browInnerUp: 0.75, browDownLeft: 0.2, mouthFrownLeft: 0.55, mouthFrownRight: 0.55, mouthPressLeft: 0.3, mouthPressRight: 0.3, eyeSquintLeft: 0.35, eyeSquintRight: 0.35, eyeBlinkLeft: 0.25, eyeBlinkRight: 0.25},
};
const POSE: Record<K, [string, number]> = {startup: ['SitSecret', 1.8], fellowship: ['SitTalkBoth', 2.2], founder: ['SitIdle', 3.0]};
const TINT: Record<K, string> = {startup: 'rgba(255,40,60,0.35)', fellowship: 'rgba(255,190,40,0.30)', founder: 'rgba(120,60,255,0.30)'};

const Big: React.FC<{children: React.ReactNode; size: number; color?: string; style?: React.CSSProperties}> = ({children, size, color = '#fff', style}) => (
  <div style={{fontFamily: F.head, fontSize: size, lineHeight: 0.95, color, WebkitTextStroke: '6px #0a0a10', paintOrder: 'stroke fill',
    textShadow: '0 10px 0 #0a0a10, 0 14px 40px rgba(0,0,0,0.75)', ...style}}>{children}</div>
);

export const Cover: React.FC<{kind: K}> = ({kind}) => {
  // tight vertical window on Avir's face/upper body (close camera)
  const z = 1.0, w = 607.5 / z, h = 1080 / z, x = 960 - w / 2, y = 0, k = 1080 / w;
  const plate: React.CSSProperties = {position: 'absolute', left: -x * k, top: -y * k, width: 1920 * k, height: 1080 * k};
  const cam = (CAMS as any).close;
  return (
    <AbsoluteFill style={{background: '#05060c', overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: 'contrast(1.18) saturate(1.35) brightness(1.05)'}}>
        <Img src={staticFile('ep1/plates/bg_close.png')} style={plate} />
        <AbsoluteFill style={{top: 0}}>
          <ThreeCanvas width={1080} height={1920} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
            <AvirLights />
            <AvirLayer t={POSE[kind][1]} cam={cam} view={{z: 1, ox: 0.5, oy: 0.5}} win={{x, y, w, h}} poses={[{name: POSE[kind][0], time: POSE[kind][1], w: 1}]}
              face={FACES[kind]} perf={{nod: 0, tilt: kind === 'startup' ? 0.08 : kind === 'founder' ? -0.06 : 0, turn: 0, lean: 0, look: [0, 0], headAim: 0.7}} lens={cam.pos} />
          </ThreeCanvas>
        </AbsoluteFill>
        <Img src={staticFile('ep1/plates/fg_close.png')} style={plate} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 62%, rgba(0,0,0,0) 30%, ${TINT[kind]} 70%, rgba(0,0,0,0.85) 100%)`}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(5,6,12,0.95) 0%, rgba(5,6,12,0.55) 22%, rgba(5,6,12,0) 36%)'}} />

      {kind === 'startup' && <>
        <div style={{position: 'absolute', top: 110, left: 0, right: 0, textAlign: 'center'}}>
          <Big size={120} style={{fontFamily: F.deva}}>मेरा</Big>
          <Big size={190} color={C.gold}>STARTUP</Big>
        </div>
        <div style={{position: 'absolute', left: -120, right: -120, top: 1520, transform: 'rotate(-7deg)', background: C.red, padding: '26px 0', textAlign: 'center',
          boxShadow: '0 0 80px rgba(255,59,71,0.8), 0 20px 40px rgba(0,0,0,0.6)', borderTop: '8px solid #0a0a10', borderBottom: '8px solid #0a0a10'}}>
          <div style={{fontFamily: F.head, fontSize: 150, color: '#fff', letterSpacing: 10, WebkitTextStroke: '4px #0a0a10', paintOrder: 'stroke fill'}}>CLASSIFIED</div>
        </div>
        <div style={{position: 'absolute', right: 60, top: 470, fontSize: 180, transform: 'rotate(12deg)', filter: 'drop-shadow(0 0 40px rgba(255,200,40,0.9))'}}>🔒</div>
      </>}

      {kind === 'fellowship' && <>
        <div style={{position: 'absolute', top: 100, left: 0, right: 0, textAlign: 'center'}}>
          <Big size={110}>STUDENTS 👀</Big>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 1340, textAlign: 'center'}}>
          <Big size={210} color={C.gold} style={{textShadow: '0 10px 0 #0a0a10, 0 0 70px rgba(255,200,40,0.9)'}}>₹2 लाख</Big>
          <Big size={92} style={{fontFamily: F.deva, marginTop: 10}}>तक · AI Fellowship</Big>
          <div style={{display: 'inline-block', marginTop: 34, padding: '14px 34px', borderRadius: 20, background: C.red, fontFamily: F.head, fontSize: 56, color: '#fff',
            border: '5px solid #0a0a10'}}>LAST DATE 30 NOV ⏰</div>
        </div>
      </>}

      {kind === 'founder' && <>
        <div style={{position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center'}}>
          <Big size={150}>FOUNDER</Big>
          <Big size={150} color={C.gold}>LIFE 💀</Big>
        </div>
        <div style={{position: 'absolute', left: 50, top: 1400, width: 470, padding: '22px 20px', borderRadius: 26, background: 'linear-gradient(160deg, #ffe7a3, #ff9f5a)',
          transform: 'rotate(-5deg)', border: '6px solid #0a0a10', textAlign: 'center'}}>
          <div style={{fontFamily: F.head, fontSize: 46, color: '#1a0f00'}}>EXPECTATION</div>
          <div style={{fontSize: 120}}>🏢💸🎉</div>
        </div>
        <div style={{position: 'absolute', right: 50, top: 1450, width: 470, padding: '22px 20px', borderRadius: 26, background: '#0b0d14', transform: 'rotate(5deg)',
          border: '6px solid #ff3b47', textAlign: 'center', boxShadow: '0 0 60px rgba(255,59,71,0.6)'}}>
          <div style={{fontFamily: F.head, fontSize: 46, color: '#ff4d5e'}}>REALITY</div>
          <div style={{fontFamily: 'monospace', fontSize: 40, color: '#ff6b74', marginTop: 8}}>✗ 47 errors</div>
          <div style={{fontFamily: F.head, fontSize: 64, color: '#fff'}}>3:00 AM</div>
        </div>
      </>}

      <div style={{position: 'absolute', left: 40, bottom: 34, padding: '8px 18px', borderRadius: 999, background: 'rgba(10,12,24,0.6)', border: '1px solid rgba(255,255,255,0.25)',
        fontFamily: F.bold, fontSize: 24, color: 'rgba(255,255,255,0.9)'}}><span style={{color: C.cyan}}>●</span>&nbsp; AI-generated virtual creator</div>
    </AbsoluteFill>
  );
};
