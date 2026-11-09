// Benchmark scene (same as the HyperFrames test): Avir still, glass news card, word-highlight caption, 6 s.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {C, Captions, F, Glass, Pop} from './ui';

const W = ['दूसरी', 'ख़बर', '—', 'Google', 'से।'].map((w, i) => ({w, t0: 0.6 + i * 0.55, t1: 0.6 + i * 0.55 + 0.5}));
export const Bench: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <Img src={staticFile('ep1/bench_bg.png')} style={{position: 'absolute', width: '100%', height: '100%'}} />
    <Pop t0={0.3} t1={5.9} dir="r" style={{left: 1220, top: 200, width: 620}}>
      {({sheen}) => <Glass sheen={sheen} style={{padding: '22px 28px'}}>
        <div style={{fontFamily: F.bold, fontSize: 19, letterSpacing: 4, color: C.saffron}}>AI NEWS 2/4</div>
        <div style={{fontFamily: F.head, fontSize: 44, color: '#fff', lineHeight: 1.1, marginTop: 4}}>Google · Gemini</div></Glass>}
    </Pop>
    <Captions words={W} end={3.6} bottom={52} size={44} />
  </AbsoluteFill>
);
