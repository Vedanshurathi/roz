import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

// Stacked kinetic title: each word springs in with overshoot, last word in the accent colour.
export const Title: React.FC<{words: string[]; accent: string}> = ({words, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, #2a1660, #0a0618 70%)',
      justifyContent: 'center', padding: 80}}>
      {words.map((w, i) => {
        const s = spring({frame: frame - i * 8, fps, config: {damping: 11, stiffness: 140}});
        const y = interpolate(s, [0, 1], [80, 0]);
        const last = i === words.length - 1;
        return (
          <div key={i} style={{fontFamily: 'Arial Black, sans-serif', fontWeight: 900, fontSize: 190,
            lineHeight: 1, color: last ? accent : 'white', opacity: s,
            transform: `translateY(${y}px) scale(${0.8 + 0.2 * s})`,
            textShadow: last ? `0 0 40px ${accent}` : '0 10px 30px rgba(0,0,0,.5)'}}>{w}</div>
        );
      })}
    </AbsoluteFill>
  );
};
