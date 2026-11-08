// Avir layer for EP001: loads avir_mp_talk.glb, matches the Cycles plate camera, blends the seated gesture clips line by
// line, and drives the ARKit face morphs (lip-sync timeline + blinks + small eye saccades + mood).
import React, {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, getInputProps, staticFile} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Cam = {pos: number[]; target: number[]; vfov_deg: number};
export type Seg = {clip: string; start: number};
export type Face = Record<string, number>;

const FADE = 0.45;
export const ONE_SHOT = new Set(['SitWave', 'SitNamaste', 'SitPoint', 'SitSecret']);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

let cache: Promise<any> | null = null;
const loadAvir = () => (cache ??= new GLTFLoader().loadAsync(staticFile('ep1/avir_mp_talk.glb')));

type Rig = {root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>;
  durs: Record<string, number>; morphs: THREE.Mesh[]; neck?: THREE.Object3D; head?: THREE.Object3D};

/** Which clips are playing at time t (with local clip time and weight); crossfades at each segment start. */
export const poseAt = (t: number, segs: Seg[], durs: Record<string, number>) => {
  let k = 0;
  for (let i = 0; i < segs.length; i++) if (segs[i].start <= t) k = i;
  const clipTime = (s: Seg) => {
    const d = durs[s.clip] ?? 6, lt = Math.max(0, t - s.start);
    return ONE_SHOT.has(s.clip) ? Math.min(lt, d - 0.01) : lt % d;
  };
  const w = k === 0 ? 1 : smooth((t - segs[k].start) / FADE);
  const out = [{name: segs[k].clip, time: clipTime(segs[k]), w}];
  if (w < 1 && k > 0) out.push({name: segs[k - 1].clip, time: clipTime(segs[k - 1]), w: 1 - w});
  return out;
};

export const AvirLayer: React.FC<{t: number; cam: Cam; segs: Seg[]; face: Face; nod: number}> = ({t, cam, segs, face, nod}) => {
  const {scene, camera, gl, size} = useThree();
  const [rig, setRig] = useState<Rig | null>(null);
  const [handle] = useState(() => delayRender('load avir'));

  useEffect(() => {
    gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.0; gl.outputColorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(gl);
    if (!(getInputProps() as any).noenv) scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    loadAvir().then((g) => {
      const root = g.scene as THREE.Object3D;   // one canvas per render tab, so the loaded scene is used directly
      const morphs: THREE.Mesh[] = [];
      let neck: THREE.Object3D | undefined, head: THREE.Object3D | undefined;
      root.traverse((o: any) => {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (o.morphTargetDictionary) morphs.push(o);
          const m = o.material;
          if (m) {
            m.envMapIntensity = 0.45;
            if (/haircut/i.test(m.name)) { m.color.setRGB(0.13, 0.12, 0.115); m.roughness = 0.82; m.envMapIntensity = 0.15; }
            if (/Cornea/i.test(o.name)) { m.transparent = true; m.opacity = 0.25; m.roughness = 0.05; }
          }
        }
        if (o.isBone && o.name === 'Neck') neck = o;
        if (o.isBone && o.name === 'Head') head = o;
      });
      scene.add(root);
      const mixer = new THREE.AnimationMixer(root);
      const actions: Record<string, THREE.AnimationAction> = {}, durs: Record<string, number> = {};
      for (const c of g.animations as THREE.AnimationClip[]) {
        const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); actions[c.name] = a; durs[c.name] = c.duration;
      }
      setRig({root, mixer, actions, durs, morphs, neck, head});
      continueRender(handle);
    });
  }, [scene, gl, handle]);

  useMemo(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = cam.vfov_deg; c.aspect = size.width / size.height; c.near = 0.05; c.far = 50;
    c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]); c.up.set(0, 1, 0); c.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    c.updateProjectionMatrix();
    if (!rig) return;
    for (const a of Object.values(rig.actions)) a.setEffectiveWeight(0);
    for (const p of poseAt(t, segs, rig.durs)) {
      const a = rig.actions[p.name]; if (!a) continue;
      a.time = p.time; a.setEffectiveWeight(p.w);
    }
    rig.mixer.update(0);
    // a little extra life on top of the clips: speech nods + slow drift
    if (rig.head) {
      rig.head.rotateX(-0.035 * nod + 0.012 * Math.sin(t * 0.83));
      rig.head.rotateY(0.02 * Math.sin(t * 0.51 + 1.3));
    }
    for (const m of rig.morphs) {
      const dict = m.morphTargetDictionary!, inf = m.morphTargetInfluences!;
      inf.fill(0);
      for (const k in face) { const i = dict[k]; if (i !== undefined) inf[i] = Math.max(0, Math.min(1, face[k])); }
    }
  }, [rig, t, cam, segs, face, nod, camera, size]);
  return null;
};

/** Lights matched to the studio plates (warm key front-right, cool fill, cyan + warm rims, diya glow from the desk). */
export const AvirLights: React.FC<{warm?: number; night?: number}> = ({warm = 1, night = 0}) => (
  <>
    <ambientLight intensity={0.25 * (1 - 0.5 * night)} color={'#b9c2ff'} />
    <directionalLight position={[1.5, 2.0, 1.9]} intensity={2.3 * (1 - 0.45 * night)} color={'#ffe7cf'} />
    <directionalLight position={[-1.4, 1.6, 2.0]} intensity={0.55} color={'#cdd6ff'} />
    <directionalLight position={[-1.2, 2.3, -1.5]} intensity={2.6} color={'#38e8ff'} />
    <directionalLight position={[1.3, 2.2, -1.5]} intensity={1.6 * warm} color={'#ffb070'} />
    <pointLight position={[0.66, 0.85, 0.86]} intensity={0.9 * warm} distance={2.2} decay={2} color={'#ff9a40'} />
    <pointLight position={[-0.6, 0.85, 0.86]} intensity={0.7 * warm} distance={2.2} decay={2} color={'#ff9a40'} />
  </>
);
