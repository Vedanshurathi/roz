// EP001 performance: the shared makePerf() with EP001's data and per-line acting choices.
import DATA from './data.json';
import MORPH from './morph.json';
import {makePerf} from './perfcore';
export * from './perfcore';

const CLIP_OVERRIDE: Record<number, string> = {5: 'SitTalkBoth', 39: 'SitWave', 3: 'SitNamaste', 38: 'SitNamaste'};
const MOOD: Record<number, number[]> = {
  0: [0.02, 0, 0.12, 0, 0], 1: [0.08, 0.05, 0, 0.1, 0], 2: [0.25, 0.15, 0, 0.15, 0], 3: [0.6, 0.15, 0, 0, 0], 4: [0.45, 0.1, 0, 0.2, 0], 5: [0.42, 0.1, 0, 0.1, 0],
  6: [0.22, 0.05, 0, 0, 0], 7: [0.35, 0.05, 0, 0, 0], 12: [0.3, 0.1, 0, 0, 0], 19: [0.22, 0.15, 0, 0, 0], 22: [0.03, 0, 0.1, 0, 0.05], 23: [0, 0, 0.16, 0, 0.08],
  25: [0.04, 0.18, 0, 0, 0.12], 29: [0.55, 0.2, 0, 0.25, 0], 31: [0.35, 0, 0, 0, 0], 32: [0.2, 0.22, 0, 0.2, 0], 33: [0.32, 0.1, 0, 0.25, 0],
  34: [0.28, 0.15, 0, 0.25, 0], 36: [0.4, 0.1, 0, 0.1, 0], 37: [0.42, 0, 0, 0, 0], 38: [0.55, 0.1, 0, 0, 0], 39: [0.5, 0.05, 0, 0, 0],
};
const GLANCE: Record<number, [number, number]> = {1: [0.5, 0.3], 10: [-0.45, 0.25], 22: [0.55, 0.15], 25: [-0.5, 0.35], 29: [0.45, 0.3], 32: [-0.4, 0.2], 35: [0.5, 0.3]};

const P = makePerf(DATA, MORPH, {clipOverride: CLIP_OVERRIDE, mood: MOOD, glance: GLANCE});
export const {L, FPS, st, en, lineAt, ENERGY, EMPH, SEGS, posesAt, BLINKS, faceAt, perfAt, SHOTS, shotAt} = P;
