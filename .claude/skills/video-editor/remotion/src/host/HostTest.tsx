// Movement + speech test for the rigged host (host.glb) driven by character-controller.js.
import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore plain JS module shared with the web player
import {CharacterController} from './character-controller.js';
import DATA from './hosttest.json';

const SCHEDULE = [
  {at: 0, anim: 'Wave'},
  {at: 2.4, anim: 'Talk'},
  {at: 7.4, anim: 'Nod'},
];
const OUTFITS = [{at: 0, o: 'casual'}, {at: 4.0, o: 'hoodie'}, {at: 5.8, o: 'tee'}];

const toonGradient = (() => {
  const d = new Uint8Array([70, 140, 200, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();

const Rig: React.FC<{t: number; frame: number}> = ({t, frame}) => {
  const {scene, camera} = useThree();
  const [ctl, setCtl] = useState<any>(null);
  const [handle] = useState(() => delayRender('load host.glb'));
  useEffect(() => {
    const c = new CharacterController(scene);
    c.load(staticFile('host/host.glb')).then(() => {
      c.model.traverse((o: any) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 0.6; } });
      setCtl(c); continueRender(handle);
    });
  }, [scene, handle]);
  useMemo(() => {
    if (!ctl) return;
    let o = OUTFITS[0].o; for (const s of OUTFITS) if (t >= s.at) o = s.o;
    ctl.setOutfit(o);
    ctl.setMood({smile: t < 2.4 ? 0.55 : 0.3, browsUp: t < 2.4 ? 0.25 : 0.1});
    ctl.speak(DATA.amp[frame] ?? 0, (DATA.vis as string[])[frame] ?? 'rest');
    ctl.lookAt(Math.sin(t * 0.7) * 0.1, 0);
    ctl.setTime(t, SCHEDULE);
  }, [ctl, t, frame]);
  const drift = Math.sin(t * 0.4) * 0.05;
  camera.position.set(0.28 + drift, 1.74, 1.75);
  camera.lookAt(0, 1.6, 0);
  return null;
};

export const HostTest: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  let label = OUTFITS[0].o; for (const s of OUTFITS) if (t >= s.at) label = s.o;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 35%, #2a2f55 0%, #0d1024 70%)'}}>
      <ThreeCanvas width={width} height={height} camera={{fov: 32, near: 0.05, far: 50}}>
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#ffe6cc', '#1a1f3d', 0.6]} />
        <directionalLight position={[-2, 3, 3]} intensity={2.2} color={'#ffd9b0'} />
        <directionalLight position={[2.5, 2, -2]} intensity={1.8} color={'#66d6ff'} />
        <directionalLight position={[1.5, 1, 3]} intensity={0.5} color={'#c8d4ff'} />
        <Rig t={t} frame={frame} />
      </ThreeCanvas>
      <Sequence from={Math.round(DATA.speechStart * fps)}><Audio src={staticFile('host/line.wav')} /></Sequence>
      <div style={{position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center', fontFamily: 'sans-serif', fontWeight: 800, fontSize: 30, color: '#fff', opacity: 0.85}}>
        RIG TEST · outfit: {label}
      </div>
    </AbsoluteFill>
  );
};
