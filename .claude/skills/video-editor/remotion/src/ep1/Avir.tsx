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
// fast lighting: hemisphere light instead of the reflection environment (about half the render time)
export const FAST = (getInputProps() as any).fast !== false;
// look: 'v1' = EP001/Reel 3 look. 'real' = more lifelike: skin with wrapped (subsurface-style) diffuse + sheen, wet eyes with
// catchlights, softer hair, self-shadows from the key light and soft image-based reflections.
export const LOOK: 'v1' | 'lite' | 'real' = (['v1', 'lite', 'real'] as const).find((k) => k === (getInputProps() as any).look) ?? 'v1';
export const REAL = LOOK === 'real';
// 'lite': the realistic materials (skin, eyes, hair) without the costly shadows / reflection environment
export const LITE = LOOK === 'lite';

/** Skin: wrap the diffuse term per colour channel (red travels furthest under skin), so the shadow edge turns soft and warm. */
const skinify = (m: THREE.MeshStandardMaterial) => {
  const p = new THREE.MeshPhysicalMaterial({name: m.name, map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, aoMap: m.aoMap,
    color: m.color, metalness: 0, roughness: Math.min(1, m.roughness * 0.95), sheen: 0.18, sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0.45, 0.16, 0.1), specularIntensity: 0.5, envMapIntensity: 0.35});
  if (p.normalMap) p.normalScale.set(1.25, 1.25);
  p.onBeforeCompile = (sh) => {
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      `vec3 wrapW = vec3( 0.46, 0.22, 0.13 );
       vec3 sss = clamp( ( dot( geometryNormal, directLight.direction ) + wrapW ) / ( 1.0 + wrapW ), 0.0, 1.0 );
       reflectedLight.directDiffuse += sss * directLight.color * BRDF_Lambert( material.diffuseColor ) * vec3( 0.95, 0.85, 0.79 );`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
  };
  p.customProgramCacheKey = () => 'avir-skin';
  return p;
};

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

export type View = {z: number; ox: number; oy: number};
export type Perf = {nod: number; tilt: number; turn: number; lean: number; look: [number, number]; headAim: number};
type Bones = Record<string, THREE.Object3D>;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _id = new THREE.Quaternion();

/** Rotate bone b (in world space) so that its forward axis turns toward `target`, by `amount`, at most `maxRad`. */
const aim = (b: THREE.Object3D, fwdLocal: THREE.Vector3, target: THREE.Vector3, amount: number, maxRad: number) => {
  b.updateWorldMatrix(true, false);
  const bw = b.getWorldQuaternion(new THREE.Quaternion());
  const f = fwdLocal.clone().applyQuaternion(bw).normalize();
  const d = target.clone().sub(b.getWorldPosition(_v)).normalize();
  _q.setFromUnitVectors(f, d);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
  const k = Math.min(amount, ang > 1e-5 ? maxRad / ang : 1);
  _q2.copy(_id).slerp(_q, k);
  const nw = _q2.multiply(bw);
  const pw = b.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  b.quaternion.copy(pw.multiply(nw));
  b.updateWorldMatrix(false, true);
};

export const AvirLayer: React.FC<{t: number; cam: Cam; view: View; poses: {name: string; time: number; w: number}[]; face: Face; perf: Perf; lens: number[];
  box?: {x: number; y: number; w: number}; hidden?: boolean; win?: {x: number; y: number; w: number; h: number}}> = ({t, cam, view, poses, face, perf, lens, box, hidden, win}) => {
  const {scene, camera, gl, size} = useThree();
  const [rig, setRig] = useState<(Rig & {bones: Bones; fwd: Record<string, THREE.Vector3>}) | null>(null);
  const [handle] = useState(() => delayRender('load avir'));

  useEffect(() => {
    gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.0; gl.outputColorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(gl);
    if (!FAST || REAL) scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    if (REAL) { (scene as any).environmentIntensity = 0.28; gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap; }
    loadAvir().then((g) => {
      const root = g.scene as THREE.Object3D;   // one canvas per render tab, so the loaded scene is used directly
      const morphs: THREE.Mesh[] = []; const bones: Bones = {};
      root.traverse((o: any) => {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (o.morphTargetDictionary) morphs.push(o);
          const m = o.material;
          if (m && !REAL && !LITE) {
            m.envMapIntensity = 0.45;
            if (/haircut/i.test(m.name)) { m.color.setRGB(0.13, 0.12, 0.115); m.roughness = 0.82; m.envMapIntensity = 0.15; }
            if (/Cornea/i.test(o.name)) { m.transparent = true; m.opacity = 0.25; m.roughness = 0.05; }
          }
          if (m && (REAL || LITE)) {
            o.castShadow = REAL; o.receiveShadow = REAL; m.envMapIntensity = 0.5;
            if (/AvatarHead|AvatarBody/.test(m.name)) o.material = skinify(m);
            else if (/Cornea/i.test(m.name)) {
              o.material = new THREE.MeshPhysicalMaterial({name: m.name, color: 0x0a0a0a, transparent: true, opacity: 0.07, roughness: 0.03, metalness: 0,
                clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.2, depthWrite: false});
              o.castShadow = false; o.receiveShadow = false; o.renderOrder = 3;
            } else if (/Eyeball/i.test(m.name)) { m.roughness = 0.3; m.envMapIntensity = 0.35; m.color.multiplyScalar(0.9); o.castShadow = false; }
            else if (/Teeth/i.test(m.name)) { m.color.multiplyScalar(0.8); m.roughness = 0.35; o.castShadow = false; }
            else if (/Eyelash/i.test(m.name)) { o.castShadow = false; }
            else if (/haircut/i.test(m.name)) {
              o.material = new THREE.MeshPhysicalMaterial({name: m.name, map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, aoMap: m.aoMap,
                color: new THREE.Color(0.105, 0.09, 0.08), roughness: 0.7, metalness: 0, specularIntensity: 0.45,
                anisotropy: 0.35, anisotropyRotation: Math.PI / 2, envMapIntensity: 0.08, transparent: false, alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide});
            } else if (/outfit/i.test(m.name)) { m.roughness = Math.min(1, m.roughness * 1.05); m.envMapIntensity = 0.3; }
          }
        }
        if (o.isBone) bones[o.name] = o;
      });
      scene.add(root); root.updateMatrixWorld(true);
      // forward (+Z, toward the camera side) expressed in each bone's local frame, from the rest pose
      const fwd: Record<string, THREE.Vector3> = {};
      for (const n of ['Head', 'LeftEye', 'RightEye']) if (bones[n]) fwd[n] = new THREE.Vector3(0, 0, 1).applyQuaternion(bones[n].getWorldQuaternion(new THREE.Quaternion()).invert());
      const mixer = new THREE.AnimationMixer(root);
      const actions: Record<string, THREE.AnimationAction> = {}, durs: Record<string, number> = {};
      for (const c of g.animations as THREE.AnimationClip[]) {
        const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); actions[c.name] = a; durs[c.name] = c.duration;
      }
      setRig({root, mixer, actions, durs, morphs, neck: bones.Neck, head: bones.Head, bones, fwd});
      continueRender(handle);
    });
  }, [scene, gl, handle]);

  useMemo(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = cam.vfov_deg; c.aspect = size.width / size.height; c.near = 0.05; c.far = 50;
    c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]); c.up.set(0, 1, 0); c.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    // zoom = crop of the full frame (matches the CSS scale of the plates), so Avir stays sharp in tight shots
    const W = size.width, H = size.height, z = Math.max(1, view.z);
    // corner window: whole frame drawn inside the box, clipped by a WebGL scissor (a CSS clip-path on the canvas is ~10x slower)
    const inBox = !!box && box.w < W - 0.5;
    if (win) {   // vertical/other crop of the 16:9 plate camera: same frustum, only a window of it fills the canvas
      c.aspect = 16 / 9; c.setViewOffset(1920, 1080, win.x, win.y, win.w, win.h); gl.setScissorTest(false);
    } else if (inBox) {
      const k = box!.w / W, bh = box!.w * H / W;
      c.setViewOffset(W, H, -box!.x / k, -box!.y / k, W / k, H / k);
      gl.setScissorTest(false); gl.clear(); gl.setScissor(box!.x, H - box!.y - bh, box!.w, bh); gl.setScissorTest(true);
    } else {
      gl.setScissorTest(false);
      if (z > 1.0001) c.setViewOffset(W, H, view.ox * W * (1 - 1 / z), view.oy * H * (1 - 1 / z), W / z, H / z); else c.clearViewOffset();
    }
    c.updateProjectionMatrix();
    if (!rig) return;
    rig.root.visible = !hidden;
    if (hidden) return;
    for (const a of Object.values(rig.actions)) a.setEffectiveWeight(0);
    for (const p of poses) { const a = rig.actions[p.name]; if (!a) continue; a.time = p.time; a.setEffectiveWeight(p.w); }
    rig.mixer.update(0);
    const B = rig.bones;
    // torso leans in while talking; head nods on stressed words, tilts on questions, turns slightly
    if (B.Spine2) B.Spine2.rotateX(perf.lean);
    if (REAL || LITE) {   // breathing: chest rises ~14 times a minute, shoulders follow, the neck cancels it so the head stays steady
      const br = Math.sin(t * 2 * Math.PI / 4.2), br2 = Math.sin(t * 2 * Math.PI / 4.2 - 0.5);
      if (B.Spine1) B.Spine1.rotateX(-0.012 * br);
      if (B.LeftShoulder) B.LeftShoulder.rotateZ(0.012 * br2); if (B.RightShoulder) B.RightShoulder.rotateZ(-0.012 * br2);
      if (B.Neck) B.Neck.rotateX(0.008 * br);
    }
    if (B.Head && rig.fwd.Head) {
      const lensV = new THREE.Vector3(lens[0], lens[1], lens[2]);
      aim(B.Head, rig.fwd.Head, lensV, perf.headAim, 0.3);
      B.Head.rotateX(perf.nod); B.Head.rotateZ(perf.tilt); B.Head.rotateY(perf.turn);
      B.Head.updateWorldMatrix(false, true);
      // eyes: into the lens, with micro-saccades and the occasional thinking glance
      const right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
      const dist = lensV.distanceTo(B.Head.getWorldPosition(_v2));
      const tgt = lensV.clone().addScaledVector(right, perf.look[0] * dist).addScaledVector(up, perf.look[1] * dist);
      for (const n of ['LeftEye', 'RightEye']) if (B[n] && rig.fwd[n]) aim(B[n], rig.fwd[n], tgt, 1, 0.45);
    }
    for (const m of rig.morphs) {
      const dict = m.morphTargetDictionary!, inf = m.morphTargetInfluences!;
      inf.fill(0);
      for (const k in face) { const i = dict[k]; if (i !== undefined) inf[i] = Math.max(0, Math.min(1, face[k])); }
    }
  }, [rig, t, cam, view, poses, face, perf, lens, box, hidden, win, camera, size, gl]);
  return null;
};

/** Lights matched to the studio plates (warm key front-right, cool fill, cyan + warm rims, diya glow from the desk). */
export const AvirLights: React.FC<{warm?: number; night?: number; premium?: boolean; gain?: number; cool?: number}> = ({warm = 1, night = 0, premium = false, gain = 1, cool = 0}) => premium ? (
  // premium studio (Reel 3+): soft warm key front-right, neutral fill, warm rims from the slat-wall LED and the floor lamp, no cyan
  <>
    {FAST && <hemisphereLight args={['#f3e7da', '#3b281b', (REAL ? 0.45 : 1.0) * gain]} />}
    <ambientLight intensity={(REAL ? 0.05 : 0.1) * gain} color={'#e9dccd'} />
    <directionalLight position={REAL ? [1.4, 2.5, 2.3] : [1.4, 1.9, 2.1]} intensity={(REAL ? 2.5 : 2.15) * gain} color={'#ffe3c6'} castShadow={REAL}
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} shadow-normalBias={0.02} shadow-radius={5}
      shadow-camera-left={-1.1} shadow-camera-right={1.1} shadow-camera-top={2.2} shadow-camera-bottom={0.2} shadow-camera-near={0.5} shadow-camera-far={8} />
    <directionalLight position={[-1.5, 1.4, 1.9]} intensity={(0.75 + 0.6 * cool) * gain} color={cool ? '#b9c8ff' : '#e6e9f2'} />
    <directionalLight position={[-1.0, 2.5, -1.4]} intensity={(1.5) * gain} color={'#ffd2a3'} />
    <directionalLight position={[1.2, 2.2, -1.5]} intensity={(1.2 * warm) * gain} color={'#ffb478'} />
    <pointLight position={[0.0, 0.9, 0.9]} intensity={(0.45) * gain} distance={2.0} decay={2} color={'#ffc896'} />
  </>
) : (
  <>
    {FAST && <hemisphereLight args={['#e8ecff', '#4a3226', 1.25 * (1 - 0.4 * night)]} />}
    <ambientLight intensity={(FAST ? 0.12 : 0.25) * (1 - 0.5 * night)} color={'#b9c2ff'} />
    <directionalLight position={[1.5, 2.0, 1.9]} intensity={2.3 * (1 - 0.45 * night)} color={'#ffe7cf'} />
    <directionalLight position={[-1.4, 1.6, 2.0]} intensity={0.55} color={'#cdd6ff'} />
    <directionalLight position={[-1.2, 2.3, -1.5]} intensity={2.6} color={'#38e8ff'} />
    <directionalLight position={[1.3, 2.2, -1.5]} intensity={1.6 * warm} color={'#ffb070'} />
    <pointLight position={[0.66, 0.85, 0.86]} intensity={0.9 * warm} distance={2.2} decay={2} color={'#ff9a40'} />
    <pointLight position={[-0.6, 0.85, 0.86]} intensity={0.7 * warm} distance={2.2} decay={2} color={'#ff9a40'} />
  </>
);
