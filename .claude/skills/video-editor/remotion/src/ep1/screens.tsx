// Full-screen B-roll for EP001: Avir's desktop (browser notes page + cursor), memes, the 3 AM terminal.
// Everything is original artwork — no third-party logos or site designs.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {C, F, clamp01, ease, ramp, useT} from './ui';

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Cursor that glides between keyframes [{t, x, y, click?}]. */
export const Cursor: React.FC<{keys: {t: number; x: number; y: number; click?: boolean}[]}> = ({keys}) => {
  const {t} = useT();
  let i = 0; for (let j = 0; j < keys.length; j++) if (keys[j].t <= t) i = j;
  const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)];
  const m = b.t - a.t > 0 ? ease(clamp01((t - (b.t - 0.55)) / 0.55)) : 0;   // arrive at each key exactly on its time
  const x = lerp(a.x, b.x, m), y = lerp(a.y, b.y, m);
  const clicks = keys.filter((q) => q.click && t >= q.t && t < q.t + 0.45);
  return (
    <>
      {clicks.map((q, n) => { const p = (t - q.t) / 0.45; return <div key={n} style={{position: 'absolute', left: q.x - 30 * p - 6, top: q.y - 30 * p - 6, width: 12 + 60 * p, height: 12 + 60 * p,
        borderRadius: '50%', border: `3px solid ${C.saffron}`, opacity: 1 - p}} />; })}
      <svg style={{position: 'absolute', left: x, top: y, width: 34, height: 44, filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.5))',
        transform: `scale(${clicks.length ? 0.86 : 1})`, transformOrigin: '0 0'}} viewBox="0 0 17 22">
        <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Typed text with a blinking caret. */
const Typed: React.FC<{text: string; t0: number; cps?: number; style?: React.CSSProperties}> = ({text, t0, cps = 16, style}) => {
  const {t} = useT(); const n = Math.max(0, Math.min(text.length, Math.floor((t - t0) * cps)));
  const caret = t >= t0 && n < text.length + 4 && Math.floor(t * 2.4) % 2 === 0;
  return <span style={style}>{text.slice(0, n)}<span style={{opacity: caret ? 1 : 0}}>|</span></span>;
};

/** Marker sweep behind a phrase. */
const Mark: React.FC<{at: number; children: React.ReactNode; color?: string}> = ({at, children, color = 'rgba(255,209,102,0.55)'}) => {
  const {t} = useT(); const p = ease(ramp(t, at, at + 0.35));
  return <span style={{background: `linear-gradient(90deg, ${color} ${p * 100}%, transparent ${p * 100}%)`, borderRadius: 6, padding: '0 4px'}}>{children}</span>;
};

/** Desktop wallpaper + a generic browser window. */
const Desktop: React.FC<{url: string; tab: string; children: React.ReactNode; clock?: string}> = ({url, tab, children, clock = '8:14 PM'}) => (
  <AbsoluteFill style={{background: 'radial-gradient(1200px 700px at 20% 10%, #3b2a6b 0%, transparent 60%), radial-gradient(900px 600px at 90% 90%, #6b3a12 0%, transparent 60%), #0d0f1c'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 34, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 22px 0 330px', fontFamily: F.bold, fontSize: 16, color: 'rgba(255,255,255,0.85)'}}>
      <span>● Avir's Desk</span><span>{clock}</span>
    </div>
    <div style={{position: 'absolute', left: 90, top: 64, width: 1740, height: 950, borderRadius: 16, overflow: 'hidden', background: '#f6f7fb',
      boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)'}}>
      <div style={{height: 46, background: '#e3e6ef', display: 'flex', alignItems: 'flex-end', padding: '0 14px', gap: 8}}>
        <div style={{display: 'flex', gap: 8, alignSelf: 'center', marginRight: 14}}>{['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 13, height: 13, borderRadius: 7, background: c}} />)}</div>
        <div style={{background: '#f6f7fb', borderRadius: '10px 10px 0 0', padding: '10px 22px', fontFamily: F.bold, fontSize: 15, color: '#333'}}>{tab}</div>
      </div>
      <div style={{height: 44, background: '#f6f7fb', display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid #e0e3ea'}}>
        <div style={{flex: 1, height: 30, borderRadius: 15, background: '#e9ecf3', display: 'flex', alignItems: 'center', padding: '0 16px', fontFamily: 'monospace', fontSize: 16, color: '#444'}}>🔒 {url}</div>
      </div>
      <div style={{position: 'relative', height: 860, overflow: 'hidden'}}>{children}</div>
    </div>
  </AbsoluteFill>
);

const NEWS = [
  {org: 'OpenAI · ChatGPT', title: 'Images 2.6: अब animated GIFs भी', date: '4 Nov 2026', src: ['The Next Web', 'Decrypt', 'MySmartPrice'], learn: 'Diwali wishes, stickers, memes — एक prompt में GIF'},
  {org: 'Google · Gemini API', title: 'Gemini Omni 1.2 Flash सबके लिए', date: '5 Nov 2026', src: ['ai-tldr', 'xenospectrum', 'runtimewire'], learn: 'AI video सस्ता हो रहा है — पर हर second का पैसा लगता है'},
  {org: 'Anthropic · Claude', title: 'Claude Personal Finance (beta)', date: '5 Nov 2026', src: ['MacRumors', '9to5Mac', 'BleepingComputer'], learn: 'किसी भी app को bank दो तो पहले देखो: read-only है या नहीं?'},
  {org: 'IndiaAI · Govt. of India', title: 'IndiaAI Fellowship 2026–27', date: 'Apply by 30 Nov 2026', src: ['Business Today', 'EducationPost', 'Biotecnika'], learn: 'Student हो? आज ही apply करो — deadline 30 Nov'},
];

const NewsPage: React.FC<{k: number; ev: number[]; t0: number; t1: number}> = ({k, ev, t0, t1}) => {
  const {t} = useT(); const n = NEWS[k];
  const card: React.CSSProperties = {background: '#fff', borderRadius: 18, boxShadow: '0 6px 24px rgba(20,30,60,0.10)', padding: '26px 30px'};
  const body: React.CSSProperties = {fontFamily: F.body, fontSize: 36, color: '#1d2233', lineHeight: 1.5};
  const show = (at: number) => ({opacity: ease(ramp(t, at - 0.15, at + 0.25)), transform: `translateY(${(1 - ease(ramp(t, at - 0.15, at + 0.25))) * 14}px)`});
  let widget: React.ReactNode = null, bullets: React.ReactNode = null, cursor: {t: number; x: number; y: number; click?: boolean}[] = [];
  if (k === 0) {
    bullets = <>
      <div style={show(ev[0])}>✍️ Prompt में बस लिखो — <Mark at={ev[1]}>animated GIF</Mark> बन जाएगा</div>
      <div style={show(ev[2])}>⚡ Image generation <Mark at={ev[2] + 0.2}>~50% तक fast</Mark> <span style={{fontSize: 22, color: '#777'}}>(OpenAI का दावा)</span></div>
      <div style={show(ev[3])}>🔄 Rollout धीरे-धीरे — अभी नहीं दिखा? थोड़ा wait करो</div>
    </>;
    widget = <div style={card}>
      <div style={{fontFamily: F.bold, fontSize: 20, color: '#8a90a6', letterSpacing: 2}}>TRY THIS PROMPT</div>
      <div style={{marginTop: 14, border: '2px solid #d8dcea', borderRadius: 14, padding: '16px 18px', fontFamily: F.body, fontSize: 26, color: '#222', minHeight: 110}}>
        <Typed text="दीये जलाता हुआ एक cute robot — animated GIF" t0={ev[0] + 0.2} cps={18} /></div>
      <div style={{marginTop: 14, display: 'inline-block', padding: '10px 22px', borderRadius: 12, background: t >= ev[1] + 0.3 ? C.saffron : '#1d2233', color: '#fff', fontFamily: F.bold, fontSize: 22}}>
        {t >= ev[1] + 0.3 ? 'GIF ✓' : 'Generate'}</div>
      <div style={{fontFamily: F.body, fontSize: 18, color: '#999', marginTop: 10}}>उदाहरण prompt · output हमने नहीं बनाया</div>
    </div>;
    cursor = [{t: t0, x: 1500, y: 880}, {t: ev[0] + 0.1, x: 1300, y: 330, click: true}, {t: ev[1] + 0.25, x: 1190, y: 470, click: true}, {t: ev[2] + 0.15, x: 640, y: 560}, {t: ev[3], x: 560, y: 650}];
  } else if (k === 1) {
    const cost = 15 * 0.07 * ease(ramp(t, ev[0] + 0.3, ev[0] + 1.3));
    bullets = <>
      <div style={show(ev[0])}>🎬 <Mark at={ev[0] + 0.2}>15 second</Mark> तक के video clips</div>
      <div style={show(ev[1])}>💸 पिछले version से <Mark at={ev[1] + 0.2}>~30% सस्ता</Mark> <span style={{fontSize: 22, color: '#777'}}>(reported)</span></div>
      <div style={show(ev[2])}>🧑‍💻 Developers के लिए <Mark at={ev[2] + 0.2}>paid API</Mark> — free app नहीं</div>
    </>;
    widget = <div style={card}>
      <div style={{fontFamily: F.bold, fontSize: 20, color: '#8a90a6', letterSpacing: 2}}>COST CALCULATOR</div>
      <div style={{fontFamily: 'monospace', fontSize: 30, color: '#222', marginTop: 16}}>15 sec × ~$0.07/sec</div>
      <div style={{fontFamily: F.head, fontSize: 64, color: C.saffron, marginTop: 6}}>≈ ${cost.toFixed(2)}</div>
      <div style={{fontFamily: F.body, fontSize: 20, color: '#888'}}>एक clip की लगभग cost (reported price)</div>
    </div>;
    cursor = [{t: t0, x: 1500, y: 880}, {t: ev[0] + 0.2, x: 1260, y: 400, click: true}, {t: ev[1] + 0.2, x: 700, y: 560}, {t: ev[2] + 0.2, x: 720, y: 650}];
  } else if (k === 2) {
    const steps = [['🏦', 'Bank'], ['🔒', 'Read-only'], ['🤖', 'Claude'], ['📊', 'ख़र्चों की समझ']];
    bullets = <>
      <div style={show(ev[1])}>🔒 Bank accounts से <Mark at={ev[1] + 0.2}>read-only</Mark> connection (Plaid के ज़रिए)</div>
      <div style={show(ev[2])}>📊 आपके ख़र्चों को समझाकर बताता है</div>
      <div style={show(ev[3])}>🇺🇸 अभी <Mark at={ev[3] + 0.2}>सिर्फ़ US</Mark> · paid plans · beta · data training में use नहीं</div>
    </>;
    widget = <div style={{...card, display: 'flex', alignItems: 'center', gap: 10}}>
      {steps.map(([e, x], i) => { const v = ease(ramp(t, ev[Math.min(i, 3)] - 0.1 + (i === 3 ? -1.8 : 0), ev[Math.min(i, 3)] + 0.3 + (i === 3 ? -1.8 : 0))); return (
        <React.Fragment key={x}>
          {i > 0 && <div style={{fontSize: 30, color: '#aab', opacity: v}}>→</div>}
          <div style={{textAlign: 'center', opacity: 0.25 + 0.75 * v, transform: `scale(${0.85 + 0.15 * v})`}}><div style={{fontSize: 50}}>{e}</div>
            <div style={{fontFamily: F.bold, fontSize: 17, color: '#333'}}>{x}</div></div>
        </React.Fragment>); })}
    </div>;
    cursor = [{t: t0, x: 1500, y: 880}, {t: ev[1] + 0.2, x: 1240, y: 360}, {t: ev[3] + 0.2, x: 640, y: 650}];
  } else {
    const pg = t >= ev[1] + 0.2;
    const amt = Math.round((t >= ev[0] + 0.2 ? (pg ? 200000 : 100000) : 0) * ease(ramp(t, (pg ? ev[1] : ev[0]) + 0.2, (pg ? ev[1] : ev[0]) + 0.9)) + (pg ? 100000 * (1 - ease(ramp(t, ev[1] + 0.2, ev[1] + 0.9))) : 0));
    bullets = <>
      <div style={show(ev[0])}>🎓 UG students: <Mark at={ev[0] + 0.2}>₹1 लाख तक</Mark></div>
      <div style={show(ev[1])}>🎓 PG students: <Mark at={ev[1] + 0.2}>₹2 लाख तक</Mark></div>
      <div style={show(ev[2])}>📅 Last date: <Mark at={ev[2] + 0.2} color="rgba(255,90,100,0.35)">30 November 2026</Mark></div>
      <div style={show(ev[3])}>🔎 PhD वाले details official portal पर check करें</div>
    </>;
    widget = <div style={card}>
      <div style={{fontFamily: F.bold, fontSize: 20, color: '#8a90a6', letterSpacing: 2}}>मुझे कितना मिल सकता है?</div>
      {['UG', 'PG'].map((x, i) => { const on = i === 0 ? t >= ev[0] + 0.2 && !pg : pg; return (
        <div key={x} style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, fontFamily: F.bold, fontSize: 26, color: '#222'}}>
          <div style={{width: 26, height: 26, borderRadius: 13, border: '3px solid #1d2233', background: on ? C.saffron : '#fff'}} />{x} student</div>); })}
      <div style={{fontFamily: F.head, fontSize: 60, color: C.saffron, marginTop: 10}}>₹{amt.toLocaleString('en-IN')} तक</div>
      <div style={{marginTop: 12, border: '2px solid #d8dcea', borderRadius: 12, padding: '10px 14px', fontFamily: 'monospace', fontSize: 22, color: '#1a56db'}}>
        <Typed text="fellowship.indiaai.gov.in" t0={ev[3]} cps={20} /></div>
    </div>;
    cursor = [{t: t0, x: 1500, y: 880}, {t: ev[0] + 0.15, x: 1158, y: 330, click: true}, {t: ev[1] + 0.15, x: 1158, y: 372, click: true}, {t: ev[2] + 0.1, x: 600, y: 690},
      {t: ev[3] - 0.1, x: 1300, y: 560, click: true}, {t: ev[4] + 0.2, x: 1330, y: 562, click: true}];
  }
  return (
    <Desktop url={`localhost:3000/ai-news/${k + 1}`} tab="Avir's AI News · 8 Nov">
      <div style={{position: 'absolute', left: 50, top: 34, right: 50, display: 'flex', gap: 12}}>
        {NEWS.map((x, i) => <div key={i} style={{padding: '8px 18px', borderRadius: 999, fontFamily: F.bold, fontSize: 17, background: i === k ? '#1d2233' : '#e9ecf3', color: i === k ? '#fff' : '#667'}}>{i + 1}. {x.org.split(' · ')[0]}</div>)}
      </div>
      <div style={{position: 'absolute', left: 60, top: 110, width: 960}}>
        <div style={{fontFamily: F.bold, fontSize: 26, color: C.saffron, letterSpacing: 1}}>{n.org} · {n.date}</div>
        <div style={{fontFamily: F.head, fontSize: 66, color: '#11152a', lineHeight: 1.1, marginTop: 8}}>{n.title}</div>
        <div style={{...body, marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14}}>{bullets}</div>
        <div style={{marginTop: 22, fontFamily: F.bold, fontSize: 20, color: '#8a90a6'}}>SOURCES: {n.src.join(' · ')}</div>
        {(() => { const at = Math.min(ev[ev.length - 1] + 0.6, t1 - 2.6); const v = ease(ramp(t, at, at + 0.4)); return v > 0 && (
          <div style={{marginTop: 30, padding: '18px 24px', borderRadius: 16, background: '#fff4e0', borderLeft: `8px solid ${C.saffron}`, opacity: v, transform: `translateY(${(1 - v) * 16}px)`}}>
            <div style={{fontFamily: F.bold, fontSize: 20, letterSpacing: 2, color: '#b5651d'}}>💡 आपके लिए सीख</div>
            <div style={{fontFamily: F.body, fontSize: 32, color: '#1d2233', marginTop: 4}}>{n.learn}</div></div>); })()}
      </div>
      <div style={{position: 'absolute', left: 1080, top: 110, width: 560}}>{widget}</div>
      <Cursor keys={cursor.map((c) => ({...c, x: c.x - 90, y: c.y - 154}))} />
    </Desktop>
  );
};

const Expectation: React.FC<{ev: number[]}> = ({ev}) => {
  const {t} = useT();
  const pop = (at: number) => { const v = ease(ramp(t, at - 0.1, at + 0.3)); return {opacity: v, transform: `scale(${0.7 + 0.3 * v}) rotate(${(1 - v) * -6}deg)`}; };
  return (
    <AbsoluteFill style={{background: 'linear-gradient(160deg, #ffe7a3 0%, #ffb35c 45%, #f2709c 100%)'}}>
      <div style={{position: 'absolute', left: 80, top: 60, fontFamily: F.head, fontSize: 110, color: '#fff', textShadow: '0 6px 30px rgba(120,40,0,0.45)'}}>EXPECTATION ✨</div>
      <div style={{position: 'absolute', left: 90, top: 250, width: 560, height: 420, borderRadius: 26, overflow: 'hidden', background: 'linear-gradient(180deg, #7fb6ff, #d6e8ff)', ...pop(ev[0])}}>
        {Array.from({length: 9}).map((_, i) => <div key={i} style={{position: 'absolute', bottom: 0, left: i * 64, width: 52, height: 120 + ((i * 73) % 200), background: '#1e2d4f',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 14px, rgba(255,220,120,0.8) 14px 20px)', backgroundSize: '100% 100%'}} />)}
        <div style={{position: 'absolute', left: 24, top: 20, fontFamily: F.head, fontSize: 46, color: '#fff', textShadow: '0 3px 10px rgba(0,0,0,0.4)'}}>🏢 बड़ा office</div>
      </div>
      <div style={{position: 'absolute', left: 700, top: 300, width: 500, padding: '24px 28px', borderRadius: 24, background: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', ...pop(ev[1])}}>
        <div style={{fontFamily: F.bold, fontSize: 20, color: '#888'}}>🔔 Bank · just now</div>
        <div style={{fontFamily: F.head, fontSize: 52, color: '#1a8f4c', marginTop: 6}}>+ ₹10,00,00,000</div>
        <div style={{fontFamily: F.body, fontSize: 26, color: '#333'}}>Funding received 💸</div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{position: 'absolute', left: 1260 + i * 18, top: 260 + i * 120, width: 560, padding: '18px 24px', borderRadius: 20, background: '#fff',
          boxShadow: '0 14px 40px rgba(0,0,0,0.18)', ...pop(ev[2] + i * 0.18)}}>
          <div style={{fontFamily: F.bold, fontSize: 24, color: '#222'}}>🎉 {['Congratulations on the launch!', '312 people reacted 👏', '“So proud of you bro!!”'][i]}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

const Reality: React.FC<{ev: number[]}> = ({ev}) => {
  const {t} = useT();
  const sun = t >= ev[2];
  const lines: [string, string, number][] = [['avir@desk:~/startup$ npm run build', '#cfd6ff', ev[0] + 0.1], ['✗ Error: Cannot find module "./final_final_v3"', '#ff6b74', ev[0] + 0.9],
    ['✗ 47 errors found', '#ff6b74', ev[1]], ['avir@desk:~/startup$ chai --refill   # cup #4 ☕', '#ffd166', ev[1] + 0.8], ['✓ build passed', '#3dffa2', ev[2] - 0.6]];
  return (
    <AbsoluteFill style={{background: sun ? 'linear-gradient(180deg, #ffcf8a, #ff9f5a)' : 'radial-gradient(900px 600px at 50% 30%, #13183a, #04050c)'}}>
      <div style={{position: 'absolute', left: 80, top: 50, fontFamily: F.head, fontSize: 110, color: sun ? '#fff' : '#ff4d5e', textShadow: '0 6px 30px rgba(0,0,0,0.5)'}}>{sun ? 'REALITY ☀️ 7:00 AM' : 'REALITY 💀 3:00 AM'}</div>
      <div style={{position: 'absolute', left: 90, top: 230, width: 1240, height: 640, borderRadius: 18, background: '#0b0d14', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', padding: '20px 30px'}}>
        <div style={{display: 'flex', gap: 9, marginBottom: 18}}>{['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />)}</div>
        {lines.filter((l) => t >= l[2]).map((l, i) => <div key={i} style={{fontFamily: 'monospace', fontSize: 32, color: l[1], marginTop: 12}}>{l[0]}</div>)}
        {sun && <div style={{fontFamily: F.deva, fontSize: 46, color: '#fff', marginTop: 30}}>…और फिर से वही सपना ✨</div>}
      </div>
    </AbsoluteFill>
  );
};

const WifiMeme: React.FC<{t0: number}> = ({t0}) => {
  const {t} = useT(); const spin = (t - t0) * 360;
  return (
    <AbsoluteFill style={{background: '#000', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
      <div style={{fontFamily: F.head, fontSize: 84, color: '#fff', letterSpacing: 2, WebkitTextStroke: '3px #000', textShadow: '0 0 0 #000, 4px 4px 0 #000'}}>DIWALI पे WIFI:</div>
      <div style={{width: 120, height: 120, borderRadius: 60, border: '14px solid #333', borderTopColor: '#fff', transform: `rotate(${spin}deg)`, margin: '40px auto'}} />
      <div style={{fontFamily: 'monospace', fontSize: 56, color: '#ff4d5e'}}>0.2 KB/s 💀</div>
    </AbsoluteFill>
  );
};

const V01Meme: React.FC<{ev: number[]; t0: number}> = ({ev, t0}) => {
  const {t} = useT(); const z = 1 + 0.25 * ease(ramp(t, t0, ev[0])); const tape = ease(ramp(t, ev[0], ev[0] + 0.15));
  return (
    <AbsoluteFill style={{background: '#111', overflow: 'hidden'}}>
      <Img src={staticFile('ep1/v01.png')} style={{position: 'absolute', left: '50%', top: '50%', height: '100%', transform: `translate(-50%, -50%) scale(${z})`, filter: `blur(${tape * 10}px) saturate(${1 - 0.5 * tape})`}} />
      <div style={{position: 'absolute', left: 60, top: 50, fontFamily: F.head, fontSize: 80, color: '#fff', textShadow: '4px 4px 0 #000'}}>AVIR v0.1 (2026)</div>
      {tape > 0 && <div style={{position: 'absolute', left: -100, right: -100, top: 470, padding: '18px 0', background: C.red, transform: `rotate(-10deg) scale(${1.7 - 0.7 * tape})`,
        fontFamily: F.head, fontSize: 90, color: '#fff', textAlign: 'center', letterSpacing: 6}}>DON'T LOOK 🙈</div>}
    </AbsoluteFill>
  );
};

export type Broll = {kind: string; t0: number; t1: number; pip: boolean; ev?: number[]};
export const BrollScene: React.FC<{b: Broll}> = ({b}) => {
  const {t} = useT(); const ev = b.ev ?? [];
  const vin = ease(ramp(t, b.t0, b.t0 + 0.25)), vout = 1 - ease(ramp(t, b.t1 - 0.2, b.t1));
  const style: React.CSSProperties = {opacity: Math.min(vin, vout) >= 0.999 ? 1 : Math.min(vin, vout), transform: `scale(${1.04 - 0.04 * vin})`};
  let inner: React.ReactNode = null;
  if (b.kind.startsWith('news')) inner = <NewsPage k={+b.kind.slice(4)} ev={ev} t0={b.t0} t1={b.t1} />;
  else if (b.kind === 'expect') inner = <Expectation ev={ev} />;
  else if (b.kind === 'reality') inner = <Reality ev={ev} />;
  else if (b.kind === 'wifi') inner = <WifiMeme t0={b.t0} />;
  else if (b.kind === 'v01') inner = <V01Meme ev={ev} t0={b.t0} />;
  return <AbsoluteFill style={style}>{inner}</AbsoluteFill>;
};
