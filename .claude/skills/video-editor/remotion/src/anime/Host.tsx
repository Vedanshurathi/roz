// The recurring host, drawn as cel-shaded anime SVG (no GPU, no image model).
// Origin = centre of the head; chin at y≈170, shoulders y≈260, torso to y≈900.
// See content-studio/brand/character-bible.md for the design rules.
import React from 'react';

export const PAL = {
  navy: '#0E1330', navy2: '#1A2150', blue: '#2F7BFF', cyan: '#33D1FF', saffron: '#FF9A3C',
  cream: '#FFF4E6', skin: '#E9B892', skinSh: '#C98A68', skinHi: '#F6D2B4', hair: '#15172B',
  hairHi: '#2E3466', lash: '#120D18', iris: '#5A3420', red: '#FF4D5E', green: '#3BE38B',
};

export type Pose = {
  mouth: number;   // 0 closed … 1 wide open (driven by voice loudness)
  blink: number;   // 0 open … 1 closed
  brow: number;    // -1 worried … 0 neutral … 1 raised/excited
  smile: number;   // 0 flat … 1 big smile
  lookX: number; lookY: number; // -1 … 1 eye direction
  tilt: number;    // head tilt in degrees
  arm: number;     // 0 = arms down … 1 = right arm pointing up-right
  hoodie?: string; hoodieSh?: string;
  rim?: number;    // 0 … 1 strength of the blue monitor rim light
};

const Eye: React.FC<{mirror?: boolean; p: Pose}> = ({mirror, p}) => {
  const lx = (mirror ? -1 : 1) * p.lookX * 9, ly = p.lookY * 6;
  const sy = 1 - 0.94 * Math.min(1, p.blink);
  const id = mirror ? 'eyeR' : 'eyeL';
  const shape = 'M -42 2 C -30 -22 30 -26 44 -6 C 34 18 -26 22 -42 2 Z';
  return (
    <g transform={mirror ? 'scale(-1,1)' : undefined}>
      <defs><clipPath id={id}><path d={shape} /></clipPath></defs>
      <g transform={`translate(0,-8) scale(1,${sy}) translate(0,8)`}>
        <path d={shape} fill="#FCFBFF" />
        <g clipPath={`url(#${id})`}>
          <path d="M -46 -30 L 50 -30 L 50 -4 C 20 -14 -20 -12 -46 0 Z" fill="#D9D3E8" />
          <ellipse cx={lx} cy={ly} rx={21} ry={25} fill="url(#irisGrad)" />
          <ellipse cx={lx} cy={ly + 1} rx={9.5} ry={12.5} fill="#140A08" />
          <circle cx={lx - 7} cy={ly - 10} r={7} fill="#fff" />
          <circle cx={lx + 8} cy={ly + 9} r={3.2} fill="#fff" opacity={0.85} />
        </g>
        <path d="M -30 18 C -10 25 20 23 36 10" stroke="#7B4436" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
      <g transform={`translate(0,${p.blink * 15})`}>
        <path d="M -50 6 C -36 -28 34 -33 52 -8 L 60 -14 C 42 -41 -38 -40 -54 -2 Z" fill={PAL.lash} />
        <path d="M 48 -10 L 64 -20 L 58 -6 Z" fill={PAL.lash} />
      </g>
    </g>
  );
};

const Mouth: React.FC<{m: number; smile: number}> = ({m, smile}) => {
  if (m < 0.08) {
    const c = -4 + smile * 14;
    return <path d={`M -27 ${-smile * 3} Q 0 ${c} 27 ${-smile * 3}`} stroke="#7A3530" strokeWidth={5.5} fill="none" strokeLinecap="round" />;
  }
  const w = 22 + 9 * m + smile * 4, h = 8 + 34 * m;
  const d = `M ${-w} 0 Q 0 ${-5 + smile * 2} ${w} 0 Q ${w * 0.7} ${h} 0 ${h} Q ${-w * 0.7} ${h} ${-w} 0 Z`;
  return (
    <g>
      <defs><clipPath id="mouthClip"><path d={d} /></clipPath></defs>
      <path d={d} fill="#4A1820" />
      <g clipPath="url(#mouthClip)">
        <rect x={-w} y={-6} width={w * 2} height={m > 0.35 ? 9 : 5} fill="#FBF7F4" />
        <ellipse cx={0} cy={h * 0.95} rx={w * 0.62} ry={h * 0.42} fill="#D8686A" />
      </g>
      <path d={d} stroke="#6E2A2C" strokeWidth={3} fill="none" />
    </g>
  );
};

export const Host: React.FC<Pose> = (p) => {
  const hood = p.hoodie ?? PAL.saffron, hoodSh = p.hoodieSh ?? '#D9702A';
  const rim = p.rim ?? 0.6;
  // pointing arm: shoulder -> elbow -> hand, blended from resting
  const a = Math.max(0, Math.min(1, p.arm));
  const ex = 285 + a * 60, ey = 600 - a * 120;
  const hx = 268 + a * 150, hy = 820 - a * 560;
  const ang = -90 + a * 40; // finger direction
  const bw = p.brow;
  return (
    <g>
      <defs>
        <radialGradient id="irisGrad" cx="50%" cy="70%" r="65%">
          <stop offset="0%" stopColor="#C77B3E" /><stop offset="55%" stopColor={PAL.iris} /><stop offset="100%" stopColor="#24120B" />
        </radialGradient>
        <linearGradient id="streak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PAL.cyan} /><stop offset="100%" stopColor={PAL.blue} />
        </linearGradient>
        <clipPath id="faceClip">
          <path d="M -145 -70 C -148 30 -120 105 -60 155 Q 0 192 60 155 C 120 105 148 30 145 -70 C 140 -170 -140 -170 -145 -70 Z" />
        </clipPath>
      </defs>
      {/* back hair */}
      <path d="M -178 -40 C -192 -205 -90 -280 10 -274 C 125 -272 205 -190 186 -40 C 182 30 164 64 152 84 L -152 84 C -168 52 -175 20 -178 -40 Z" fill={PAL.hair} />
      {/* left arm (resting) */}
      <path d="M -228 330 C -262 450 -272 600 -262 820" stroke={hood} strokeWidth={96} fill="none" strokeLinecap="round" />
      <path d="M -250 420 C -268 540 -272 660 -266 820" stroke={hoodSh} strokeWidth={30} fill="none" strokeLinecap="round" opacity={0.6} />
      {/* torso: hoodie over white tee */}
      <path d="M -238 330 C -232 268 -170 244 -95 234 L 95 234 C 170 244 232 268 238 330 L 272 920 L -272 920 Z" fill={hood} />
      <path d="M 120 250 C 200 270 236 300 240 340 L 272 920 L 170 920 C 190 700 180 450 120 250 Z" fill={hoodSh} opacity={0.55} />
      <path d="M -56 228 L 0 302 L 56 228 Z" fill="#EEF0F8" />
      <path d="M -126 236 C -112 330 112 330 126 236" stroke={hoodSh} strokeWidth={34} fill="none" strokeLinecap="round" />
      <path d="M -30 300 L -38 430" stroke={PAL.cream} strokeWidth={7} strokeLinecap="round" />
      <path d="M 30 300 L 38 430" stroke={PAL.cream} strokeWidth={7} strokeLinecap="round" />
      <rect x={-46} y={426} width={16} height={26} rx={5} fill="#B8BCCF" />
      <rect x={30} y={426} width={16} height={26} rx={5} fill="#B8BCCF" />
      <path d="M -150 650 L 150 650 L 175 800 L -175 800 Z" fill={hoodSh} opacity={0.45} />
      {/* chest spark mark (own brand mark, not a third-party logo) */}
      <path d="M -130 360 l 8 22 l 22 8 l -22 8 l -8 22 l -8 -22 l -22 -8 l 22 -8 Z" fill={PAL.navy} opacity={0.85} />
      {/* right arm: blends from resting to pointing */}
      <polyline points={`228,330 ${ex},${ey} ${hx},${hy}`} stroke={hood} strokeWidth={94} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`${ex - 10},${ey + 30} ${hx - 14},${hy + 20}`} stroke={hoodSh} strokeWidth={26} fill="none" strokeLinecap="round" opacity={0.55} />
      {a > 0.05 && (
        <g transform={`translate(${hx},${hy}) rotate(${ang + 90})`}>
          <rect x={-40} y={-26} width={80} height={36} rx={14} fill={PAL.cream} opacity={0.9} />
          <ellipse cx={0} cy={-52} rx={40} ry={36} fill={PAL.skin} />
          <rect x={-12} y={-142} width={24} height={86} rx={12} fill={PAL.skin} />
          <path d="M -36 -64 C -30 -40 20 -36 38 -60" stroke={PAL.skinSh} strokeWidth={5} fill="none" />
          <rect x={-8} y={-140} width={9} height={18} rx={4} fill={PAL.skinHi} opacity={0.8} />
        </g>
      )}
      {/* head */}
      <g transform={`rotate(${p.tilt} 0 160)`}>
        <path d="M -50 110 L -54 250 Q 0 280 54 250 L 50 110 Z" fill={PAL.skin} />
        <path d="M -50 150 Q 0 215 50 150 L 52 205 Q 0 240 -52 205 Z" fill={PAL.skinSh} opacity={0.75} />
        <ellipse cx={-143} cy={22} rx={22} ry={38} fill={PAL.skin} />
        <ellipse cx={143} cy={22} rx={22} ry={38} fill={PAL.skinSh} />
        <path d="M -145 -70 C -148 30 -120 105 -60 155 Q 0 192 60 155 C 120 105 148 30 145 -70 C 140 -170 -140 -170 -145 -70 Z" fill={PAL.skin} />
        <g clipPath="url(#faceClip)">
          <path d="M 78 -200 C 152 -60 142 80 36 210 L 240 210 L 240 -200 Z" fill={PAL.skinSh} opacity={0.5} />
          <path d="M -160 -110 C -60 -70 60 -70 160 -110 L 160 -66 C 60 -40 -60 -40 -160 -66 Z" fill={PAL.skinSh} opacity={0.35} />
          <ellipse cx={-90} cy={-10} rx={46} ry={60} fill={PAL.skinHi} opacity={0.35} />
        </g>
        <path d="M 142 -60 C 146 20 122 100 62 153" stroke={PAL.cyan} strokeWidth={7} fill="none" opacity={rim} strokeLinecap="round" />
        <ellipse cx={-90} cy={74} rx={24} ry={9} fill="#FF7E6E" opacity={0.28 + p.smile * 0.12} />
        <ellipse cx={90} cy={74} rx={24} ry={9} fill="#FF7E6E" opacity={0.22 + p.smile * 0.12} />
        <g transform="translate(-76,18) scale(1.1)"><Eye p={p} mirror /></g>
        <g transform="translate(76,18) scale(1.1)"><Eye p={p} /></g>
        <path d="M 10 58 L 3 90 L 16 92" stroke={PAL.skinSh} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <g transform="translate(0,124)"><Mouth m={p.mouth} smile={p.smile} /></g>
        {/* front hair: spiky bangs + signature blue streak */}
        <path d="M -168 -36 C -180 -175 -92 -256 10 -254 C 122 -252 196 -172 172 -36 L 152 -76 L 132 -14 L 110 -98 L 80 -26 L 62 -110 L 26 -36 L 8 -122 L -24 -36 L -48 -116 L -80 -24 L -100 -104 L -130 -16 L -144 -86 Z" fill={PAL.hair} />
        <path d="M -168 -36 L -156 70 L -140 -6 Z" fill={PAL.hair} />
        <path d="M 172 -36 L 158 70 L 144 -6 Z" fill={PAL.hair} />
        <path d="M 34 -244 C 70 -190 80 -146 70 -104 L 52 -60 L 34 -112 C 26 -156 24 -206 34 -244 Z" fill="url(#streak)" />
        <path d="M -118 -176 C -64 -212 44 -218 116 -182" stroke="#4A5AA8" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.55} />
        <path d="M -70 -238 L -40 -300 L -20 -244 Z M 40 -250 L 92 -296 L 84 -232 Z" fill={PAL.hair} />
        {/* brows: inner ends rise when worried, whole brow lifts when excited */}
        <g transform={`translate(-78,${-58 - Math.max(0, bw) * 9}) rotate(${-bw * -1 * (bw < 0 ? 14 : 4)})`}>
          <path d="M -36 4 C -18 -6 16 -9 36 -3" stroke={PAL.hair} strokeWidth={9} fill="none" strokeLinecap="round" />
        </g>
        <g transform={`translate(78,${-58 - Math.max(0, bw) * 9}) scale(-1,1) rotate(${-bw * -1 * (bw < 0 ? 14 : 4)})`}>
          <path d="M -36 4 C -18 -6 16 -9 36 -3" stroke={PAL.hair} strokeWidth={9} fill="none" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
};
