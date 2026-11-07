// character-controller.js — controller for the recurring host (host.glb), adapted from the owner's starting point.
// Matches the real model: Mixamo-style skeleton, ARKit-style morph targets, outfits listed in the rig's glTF extras.
// Works live (update() with a clock) and frame-exact for video rendering (setTime(seconds)).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Simple viseme presets built from the model's morph targets (values 0..1).
export const VISEMES = {
  rest: {},
  aa: { jawOpen: 0.75, mouthStretch: 0.1 },
  ee: { jawOpen: 0.25, mouthStretch: 0.8, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 },
  ih: { jawOpen: 0.3, mouthStretch: 0.45 },
  oh: { jawOpen: 0.5, mouthFunnel: 0.6 },
  ou: { jawOpen: 0.15, mouthPucker: 0.9 },
  mbp: { mouthPress: 1.0 },
  fv: { jawOpen: 0.1, mouthShrugLower: 0.7 },
};

export class CharacterController {
  constructor(scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.clock = new THREE.Clock();
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.outfits = {};            // read from the model (rig extras "outfits")
    this.faceMap = {              // friendly names -> real morph target names in host.glb
      blink: ["eyeBlinkLeft", "eyeBlinkRight"],
      smile: ["mouthSmileLeft", "mouthSmileRight"],
      mouthOpen: ["jawOpen"],
      frown: ["mouthFrownLeft", "mouthFrownRight"],
      browsUp: ["browInnerUp", "browOuterUpLeft", "browOuterUpRight"],
      browsDown: ["browDownLeft", "browDownRight"],
      squint: ["eyeSquintLeft", "eyeSquintRight"],
    };
    this.morphMeshes = [];
    this.eyes = [];
    this._expr = {};              // persistent expression values (smile, brows, ...)
    this._blinkAt = 2.0;
  }

  async load(modelUrl) {
    const gltf = await this.loader.loadAsync(modelUrl);
    this.model = gltf.scene;
    this.scene.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.model.traverse((o) => {
      if (o.userData?.outfits) this.outfits = JSON.parse(o.userData.outfits);
      if (o.morphTargetDictionary) this.morphMeshes.push(o);
      if (o.isBone && /^(Left|Right)Eye$/.test(o.name)) this.eyes.push(o);
      if (o.isMesh) o.frustumCulled = false;   // skinned meshes move outside their bind-pose bounds
    });
    this.eyes.forEach((e) => (e.userData.rest = e.quaternion.clone()));
    const first = Object.keys(this.outfits)[0];
    if (first) this.setOutfit(first);
    return { model: this.model, animationNames: Object.keys(this.actions), faceControls: this.listFaceControls(), outfits: Object.keys(this.outfits) };
  }

  play(animationName, fadeSeconds = 0.3, { loop = true } = {}) {
    const next = this.actions[animationName];
    if (!next) { console.warn(`Animation not found: ${animationName}`); return false; }
    if (this.currentAction === next) return true;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.fadeIn(fadeSeconds).play();
    if (this.currentAction) this.currentAction.fadeOut(fadeSeconds);
    this.currentAction = next;
    return true;
  }

  setOutfit(outfitName) {
    if (!this.model || !this.outfits[outfitName]) { console.warn(`Outfit not available: ${outfitName}`); return false; }
    const all = new Set(Object.values(this.outfits).flat());
    const selected = new Set(this.outfits[outfitName]);
    let found = false;
    this.model.traverse((o) => {
      if (all.has(o.name)) { o.visible = selected.has(o.name); if (o.visible) found = true; }
    });
    if (!found) console.warn("Outfit meshes do not match this model.");
    return found;
  }

  // Set a morph (or friendly control) directly, 0..1.
  setExpression(control, value) {
    const names = this.faceMap[control] || [control];
    const v = THREE.MathUtils.clamp(value, 0, 1);
    let found = false;
    for (const m of this.morphMeshes) {
      for (const n of names) {
        const i = m.morphTargetDictionary[n];
        if (i !== undefined) { m.morphTargetInfluences[i] = v; found = true; }
      }
    }
    return found;
  }

  // Persistent mood (e.g. {smile: 0.4, browsUp: 0.2}); combined every frame with blink + speech.
  setMood(mood) { this._expr = { ...mood }; }

  // Speech: amp 0..1 (voice loudness this frame) and an optional viseme key from VISEMES.
  speak(amp, viseme = "aa") {
    this._speech = { amp: THREE.MathUtils.clamp(amp, 0, 1), viseme };
  }

  lookAt(x, y) {   // -1..1 gaze offsets
    for (const e of this.eyes) {
      e.quaternion.copy(e.userData.rest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(y * 0.25, 0, -x * 0.35)));
    }
  }

  listFaceControls() {
    const s = new Set();
    this.morphMeshes.forEach((m) => Object.keys(m.morphTargetDictionary).forEach((n) => s.add(n)));
    return [...s];
  }

  _blinkValue(t) {
    // deterministic natural blinking: ~every 2.5-4.5 s, 0.15 s long
    const period = 3.4, phase = (t % period) / period, local = (t % period);
    const jitter = (Math.sin(Math.floor(t / period) * 12.9898) * 43758.5453) % 1;
    const at = 0.4 + Math.abs(jitter) * 2.5;
    const d = Math.abs(local - at);
    return d < 0.08 ? 1 - d / 0.08 : 0;
  }

  _applyFace(t) {
    const vals = {};
    const add = (n, v) => (vals[n] = Math.min(1, (vals[n] || 0) + v));
    for (const [k, v] of Object.entries(this._expr)) (this.faceMap[k] || [k]).forEach((n) => add(n, v));
    const b = this._blinkValue(t); add("eyeBlinkLeft", b); add("eyeBlinkRight", b);
    if (this._speech) {
      const preset = VISEMES[this._speech.viseme] || VISEMES.aa;
      for (const [n, v] of Object.entries(preset)) add(n, v * this._speech.amp);
    }
    for (const m of this.morphMeshes) {
      m.morphTargetInfluences.fill(0);
      for (const [n, v] of Object.entries(vals)) {
        const i = m.morphTargetDictionary[n];
        if (i !== undefined) m.morphTargetInfluences[i] = v;
      }
    }
  }

  // Live use (requestAnimationFrame loop).
  update() {
    const dt = this.clock.getDelta();
    this._t = (this._t || 0) + dt;
    if (this.mixer) this.mixer.update(dt);
    this._applyFace(this._t);
  }

  // Frame-exact use (video rendering): position everything at absolute time t (seconds).
  setTime(t, schedule) {
    if (schedule) {           // [{at, anim}] — crossfade handled by weights
      let cur = schedule[0];
      for (const s of schedule) if (t >= s.at) cur = s;
      if (this._sched !== cur) { this._sched = cur; this.mixer.stopAllAction(); this.currentAction = null; this.play(cur.anim, 0); this._schedStart = cur.at; }
      this.mixer.setTime(t - this._schedStart);
    } else if (this.mixer) this.mixer.setTime(t);
    this._applyFace(t);
  }

  dispose() {
    if (this.mixer && this.model) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); }
    if (this.model) this.scene.remove(this.model);
  }
}
