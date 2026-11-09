// Reusable performance layer: turns any episode's voice timeline into body + face acting and a shot plan.
// makePerf(DATA from prep, MORPH per frame, per-episode options) — see perf.ts (EP001) and reel2 for examples.
import {ONE_SHOT, Seg} from './Avir';

export const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
export type Pose = {name: string; time: number; w: number};
export type Perf = {nod: number; tilt: number; turn: number; lean: number; look: [number, number]; headAim: number};
export type Cam = 'close' | 'medium' | 'side' | 'wide';
export type Shot = {cam: Cam; t0: number; t1: number; z0: number; z1: number; ox: number; oy: number; dx: number};
export const FACE_AT: Record<Cam, [number, number]> = {close: [0.5, 0.4], medium: [0.5, 0.29], side: [0.53, 0.36], wide: [0.5, 0.56]};

export type PerfOpts = {clipOverride?: Record<number, string>; mood?: Record<number, number[]>; glance?: Record<number, [number, number]>};
export function makePerf(DATA: any, MORPH: any, opts: PerfOpts = {}) {

  type Line = {start: number; dur: number; shot: string; clip: string; cap: string; words: {w: string; t0: number; t1: number}[]; [k: string]: any};
  const L = DATA.lines as Line[];
  const FPS = 24;
  const MORPHS = MORPH as Record<string, number>[];
  const NF = MORPHS.length;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const st = (i: number) => L[i].start;
  const en = (i: number) => L[i].start + L[i].dur;
  const lineAt = (t: number) => { let k = -1; for (let i = 0; i < L.length; i++) if (t >= L[i].start - 0.12) k = i; return k; };

  // ---------- speech energy, emphasis, gesture phase ----------
  const jaw = Array.from({length: NF}, (_, f) => MORPHS[f]?.jawOpen ?? 0);
  const win = (a: number[], f: number, r: number) => { let s = 0, n = 0; for (let j = f - r; j <= f + r; j++) if (j >= 0 && j < a.length) { s += a[j]; n++; } return n ? s / n : 0; };
  const ENERGY = jaw.map((_, f) => clamp01(win(jaw, f, 8) / 0.3));
  const jawS = jaw.map((_, f) => win(jaw, f, 2));
  const EMPH: number[] = [];   // stressed-syllable times
  for (let f = 10, last = -99; f < NF - 10; f++) {
    let peak = jawS[f] > 0.27;
    for (let j = f - 7; peak && j <= f + 7; j++) if (jawS[j] > jawS[f]) peak = false;
    if (peak && f - last > 13) { EMPH.push(f / FPS); last = f; }
  }
  const PHASE: number[] = [];
  for (let f = 0, p = 0; f < NF + 200; f++) { p += (0.6 + 0.75 * (ENERGY[f] ?? 0)) / FPS; PHASE.push(p); }

  // ---------- body: clip mixture ----------
  const DURS: Record<string, number> = {SitIdle: 8, SitNamaste: 4, SitPoint: 4, SitSecret: 5, SitTalkBoth: 6, SitTalkRight: 6, SitWave: 4};
  const OFF: Record<string, number> = {SitTalkBoth: 1.7, SitTalkRight: 3.1, SitIdle: 0.6};
  // gesture choice per line (one-shots only where they read well on camera)
  const CLIP_OVERRIDE: Record<number, string> = opts.clipOverride ?? {};
  const SEGS: Seg[] = (() => {
    const out: Seg[] = [{clip: 'SitIdle', start: -10}];
    L.forEach((l, i) => {
      const clip = CLIP_OVERRIDE[i] ?? l.clip;
      const s = l.start - 0.3, last = out[out.length - 1];
      if (clip === last.clip && !ONE_SHOT.has(clip)) return;
      out.push({clip, start: s});
      if (ONE_SHOT.has(clip)) {
        const back = s + DURS[clip] - 0.6, next = i + 1 < L.length ? L[i + 1].start - 0.3 : 1e9;
        if (back < next - 0.4) out.push({clip: l.start + l.dur > back + 1.2 ? 'SitTalkRight' : 'SitIdle', start: back});
      }
    });
    return out;
  })();

  const mixFor = (seg: Seg, t: number, f: number): Pose[] => {
    if (ONE_SHOT.has(seg.clip)) return [{name: seg.clip, time: Math.min(Math.max(0, t - seg.start), DURS[seg.clip] - 0.01), w: 1}];
    const e = ENERGY[Math.min(NF - 1, f)] ?? 0;
    const idleT = (t * 0.85 + OFF.SitIdle) % DURS.SitIdle;
    if (seg.clip === 'SitIdle') { const g = 0.15 + 0.35 * smooth(e); return [{name: 'SitIdle', time: idleT, w: 1 - g}, {name: 'SitTalkRight', time: (PHASE[f] + OFF.SitTalkRight) % 6, w: g}]; }
    const g = 0.3 + 0.7 * smooth(e * 1.2);
    return [{name: seg.clip, time: (PHASE[f] + OFF[seg.clip]) % DURS[seg.clip], w: g}, {name: 'SitIdle', time: idleT, w: 1 - g}];
  };
  const posesAt = (t: number, f: number): Pose[] => {
    let k = 0; for (let i = 0; i < SEGS.length; i++) if (SEGS[i].start <= t) k = i;
    const w = k === 0 ? 1 : smooth((t - SEGS[k].start) / 0.5);
    const acc: Record<string, Pose> = {};
    const addAll = (ps: Pose[], s: number) => ps.forEach((p) => { if (acc[p.name]) acc[p.name].w += p.w * s; else acc[p.name] = {...p, w: p.w * s}; });
    addAll(mixFor(SEGS[k], t, f), w);
    if (w < 1 && k > 0) addAll(mixFor(SEGS[k - 1], t, f), 1 - w);
    return Object.values(acc);
  };

  // ---------- face ----------
  // [smile, browUp, browDown, smirk, frown]
  const MOOD: Record<number, number[]> = opts.mood ?? {};
  const moodOf = (i: number) => MOOD[i] ?? [0.14, 0, 0, 0, 0];
  // blinks: preferably at pauses between words, never more than ~4.5 s apart
  const PAUSES: number[] = [];
  L.forEach((l) => l.words.forEach((w, j) => { const nx = l.words[j + 1]; if (nx && nx.t0 - w.t1 > 0.12) PAUSES.push(w.t1 + 0.03); }));
  L.forEach((l) => PAUSES.push(l.start + l.dur + 0.1));
  PAUSES.sort((a, b) => a - b);
  const BLINKS = (() => {
    const R = rng(41); const b: number[] = []; let last = 0.8;
    for (const p of PAUSES) { if (p - last > 4.6) { for (let x = last + 3.2; x < p - 1.2; x += 3.2 + R()) b.push(x); } if (p - (b[b.length - 1] ?? 0) > 1.6 && R() < 0.6) { b.push(p); if (R() < 0.12) b.push(p + 0.3); } last = b[b.length - 1] ?? last; }
    return b;
  })();
  const PHRASE_END = PAUSES;
  const bump = (x: number) => (x < 0 || x > 1 ? 0 : Math.sin(Math.PI * x));

  const faceAt = (t: number, f: number) => {
    const face: Record<string, number> = {...(MORPHS[f] ?? {})};
    const add = (k: string, v: number) => { face[k] = Math.min(1, (face[k] ?? 0) + v); };
    const k = Math.max(0, lineAt(t)); const w = k > 0 ? smooth((t - L[k].start + 0.4) / 0.6) : 1;
    const m0 = moodOf(Math.max(0, k - 1)), m1 = moodOf(k); const m = m1.map((v, i) => v * w + m0[i] * (1 - w));
    const j = face.jawOpen ?? 0;
    // smile breathes a little and grows at phrase ends; smirk is one-sided
    let endSmile = 0; for (const p of PHRASE_END) if (t > p - 0.1 && t < p + 0.9) endSmile = Math.max(endSmile, bump((t - p + 0.1) / 1.0));
    const smile = (m[0] * (0.85 + 0.15 * Math.sin(t * 0.9)) + 0.12 * endSmile * (m[0] > 0.1 ? 1 : 0)) * (1 - 0.5 * j);
    add('mouthSmileLeft', smile + m[3] * (1 - 0.6 * j)); add('mouthSmileRight', smile);
    add('cheekSquintLeft', smile * 0.5 + m[3] * 0.3); add('cheekSquintRight', smile * 0.5);
    add('eyeSquintLeft', smile * 0.3); add('eyeSquintRight', smile * 0.3);
    add('mouthFrownLeft', m[4]); add('mouthFrownRight', m[4]);
    // stressed words: brows lift
    let br = 0; EMPH.forEach((e, i) => { const x = (t - e + 0.08) / 0.5; if (x >= 0 && x <= 1) br = Math.max(br, (i % 3 === 2 ? 0.45 : 0.28) * bump(x)); });
    add('browInnerUp', m[1] + br); add('browOuterUpLeft', m[1] * 0.7 + br * 0.8); add('browOuterUpRight', m[1] * 0.7 + br * 0.65);
    add('browDownLeft', m[2]); add('browDownRight', m[2]);
    // lips close softly after a phrase
    let press = 0; for (const p of PHRASE_END) if (t > p && t < p + 0.35) press = Math.max(press, 0.25 * bump((t - p) / 0.35));
    add('mouthPressLeft', press); add('mouthPressRight', press);
    // blinks
    let bl = 0; for (const b of BLINKS) { const x = (t - b) / 0.16; if (x >= 0 && x < 1) bl = Math.max(bl, Math.sin(Math.PI * Math.pow(x, 0.7))); }
    add('eyeBlinkLeft', bl); add('eyeBlinkRight', bl);
    return face;
  };

  // ---------- head / eyes / torso ----------
  const GLANCE: Record<number, [number, number]> = opts.glance ?? {};
  const SACC = (() => { const R = rng(7); const s: {t: number; x: number; y: number}[] = [{t: 0, x: 0, y: 0}]; let x = 0.6; while (x < DATA.total + 2) { s.push({t: x, x: (R() - 0.5) * 0.06, y: (R() - 0.5) * 0.04}); x += 0.7 + R() * 1.6; } return s; })();
  const perfAt = (t: number, f: number): Perf => {
    let nod = 0; for (const e of EMPH) { const x = (t - e + 0.05) / 0.42; if (x >= 0 && x <= 1) nod = Math.max(nod, bump(x)); }
    const e = ENERGY[Math.min(NF - 1, f)] ?? 0;
    const k = Math.max(0, lineAt(t));
    const q = L[k].words.find((w) => w.w.includes('?'));
    const tilt = q ? 0.07 * bump((t - q.t0 + 0.5) / 1.3) : 0;
    let gx = 0, gy = 0;
    for (const [li, [x, y]] of Object.entries(GLANCE)) { const s = st(+li) - 0.05; const a = smooth((t - s) / 0.15) * (1 - smooth((t - s - 0.75) / 0.3)); gx += x * a; gy += y * a; }
    let si = 0; for (let i = 0; i < SACC.length; i++) if (SACC[i].t <= t) si = i;
    const a = SACC[Math.max(0, si - 1)], b = SACC[si], qq = smooth((t - b.t) / 0.06);
    return {nod: 0.05 * nod, tilt, turn: 0.025 * Math.sin(t * 0.47 + 0.8) + 0.04 * gx, lean: 0.035 * e,
      look: [gx + a.x + (b.x - a.x) * qq, gy + a.y + (b.y - a.y) * qq], headAim: 0.45};
  };

  // ---------- shot plan ----------
  const ALT: Record<Cam, Cam[]> = {close: ['medium', 'close'], medium: ['close', 'medium'], side: ['close', 'medium'], wide: ['medium', 'close']};
  const SHOTS: Shot[] = (() => {
    const shots: Shot[] = []; const R = rng(23);
    const push = (cam: Cam, t0: number, t1: number, tight: boolean) => {
      const n = shots.length, mode = n % 3;   // push in / drift / pull out, never a locked-off frame
      const zb = tight ? (cam === 'close' ? 1.28 : cam === 'medium' ? 1.45 : 1.15) : 1.0;
      const [ox, oy] = FACE_AT[cam];
      shots.push({cam, t0, t1, z0: zb + (mode === 2 ? 0.06 : 0.0), z1: zb + (mode === 0 ? 0.06 : mode === 1 ? 0.025 : 0.0), ox, oy, dx: (R() - 0.5) * 0.04});
    };
    L.forEach((l, i) => {
      const t0 = i === 0 ? 0 : l.start - 0.12; const t1 = i + 1 < L.length ? L[i + 1].start - 0.12 : DATA.total;
      const base = l.shot as Cam;
      // split long lines at the pause nearest to every ~3.6 s
      const cuts: number[] = []; let from = t0;
      const ps = l.words.filter((w, j) => l.words[j + 1] && (/[?।,—…!.:;]$/.test(w.w) || l.words[j + 1].t0 - w.t1 > 0.05)).map((w, j) => w.t1 + 0.06);
      while (t1 - from > 5.2) {
        const want = from + 3.6; const c = ps.filter((p) => p > from + 2.2 && p < t1 - 1.8).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
        if (!c) break; cuts.push(c); from = c;
      }
      const bounds = [t0, ...cuts, t1];
      for (let s = 0; s < bounds.length - 1; s++) {
        let cam = base, tight = false;
        if (s > 0) { cam = ALT[base][(s - 1) % 2]; tight = cam === base || (cam === 'close' && s % 2 === 1); }
        if (i === 23 || i === 33) tight = true;   // short punch lines go tight
        push(cam, bounds[s], bounds[s + 1], tight);
      }
    });
    return shots;
  })();
  const shotAt = (t: number) => { let s = SHOTS[0]; for (const x of SHOTS) if (x.t0 <= t) s = x; return s; };

  return {L, FPS, st, en, lineAt, ENERGY, EMPH, SEGS, posesAt, BLINKS, faceAt, perfAt, SHOTS, shotAt};
}
