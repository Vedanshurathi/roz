// prettier-ignore
/**
 * Hand-drawn produce illustrations from the original customer app (customer/index.html),
 * moved here unchanged. Keys are catalogue keys (p1…p107). These are our own fixed strings —
 * never user content — so they may be rendered as inline SVG (see Art.tsx).
 */
export const SH ='<ellipse cx="50" cy="90" rx="28" ry="4.5" fill="#16150F" opacity=".11"/>';
export const ART: Record<string, string> = {

/* ---------- PYAAZ–ALOO ---------- */
p1:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a1" cx="34%" cy="28%"><stop offset="0" stop-color="#DDAE72"/><stop offset=".62" stop-color="#BC8848"/><stop offset="1" stop-color="#8E6031"/></radialGradient></defs>${SH}
<path d="M23 50c-5-17 8-32 27-32 17 0 29 10 29 26 0 19-13 34-30 34S27 66 23 50z" fill="url(#a1)"/>
<ellipse cx="39" cy="44" rx="3.4" ry="2.2" fill="#6E4922" opacity=".5" transform="rotate(-24 39 44)"/>
<ellipse cx="62" cy="60" rx="2.9" ry="1.9" fill="#6E4922" opacity=".45"/>
<ellipse cx="53" cy="33" rx="2.4" ry="1.6" fill="#6E4922" opacity=".4"/>
<ellipse cx="45" cy="70" rx="2.6" ry="1.7" fill="#6E4922" opacity=".38" transform="rotate(15 45 70)"/>
<ellipse cx="38" cy="35" rx="9" ry="5" fill="#fff" opacity=".22" transform="rotate(-28 38 35)"/></svg>`,

p2:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a2" cx="34%" cy="30%"><stop offset="0" stop-color="#E3A6A8"/><stop offset=".5" stop-color="#B85C63"/><stop offset="1" stop-color="#7A2A3C"/></radialGradient></defs>${SH}
<path d="M50 20c-3-6-6-9-9-11 5-1 8 1 9 4 1-3 4-5 9-4-3 2-6 5-9 11z" fill="#7BAE4E"/>
<path d="M50 22c17 0 29 13 29 29S67 84 50 84 21 71 21 51s12-29 29-29z" fill="url(#a2)"/>
<path d="M50 22c-6 8-9 20-9 30s3 22 9 32M50 22c6 8 9 20 9 30s-3 22-9 32M35 27c-4 8-6 17-6 25 0 10 2 20 7 28M65 27c4 8 6 17 6 25 0 10-2 20-7 28" stroke="#7A2A3C" stroke-width="1.3" fill="none" opacity=".38"/>
<path d="M46 85c-2 3-4 5-7 6M54 85c2 3 4 5 7 6M50 85v7" stroke="#C9B79E" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<ellipse cx="38" cy="38" rx="8" ry="12" fill="#fff" opacity=".2" transform="rotate(-22 38 38)"/></svg>`,

p3:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a3" cx="36%" cy="30%"><stop offset="0" stop-color="#FFFDF8"/><stop offset=".6" stop-color="#EFE6D6"/><stop offset="1" stop-color="#C9B99F"/></radialGradient></defs>${SH}
<path d="M50 16c2 6 3 11 3 16h-6c0-5 1-10 3-16z" fill="#C6B79B"/>
<path d="M50 28c16 0 27 12 27 27 0 17-11 29-27 29S23 72 23 55c0-15 11-27 27-27z" fill="url(#a3)"/>
<path d="M50 28c-7 9-10 20-10 29 0 10 3 20 10 27M50 28c7 9 10 20 10 29 0 10-3 20-10 27M33 36c-3 7-5 13-5 20 0 12 3 21 8 27M67 36c3 7 5 13 5 20 0 12-3 21-8 27" stroke="#BFAE92" stroke-width="1.3" fill="none" opacity=".65"/>
<ellipse cx="38" cy="42" rx="7" ry="11" fill="#fff" opacity=".5" transform="rotate(-20 38 42)"/></svg>`,

p4:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CBB088"/><stop offset="1" stop-color="#9C7C51"/></linearGradient><radialGradient id="a4b" cx="35%" cy="30%"><stop offset="0" stop-color="#DDAE72"/><stop offset="1" stop-color="#A8763F"/></radialGradient></defs>${SH}
<ellipse cx="36" cy="34" rx="12" ry="10" fill="url(#a4b)"/><ellipse cx="58" cy="30" rx="13" ry="11" fill="url(#a4b)"/><ellipse cx="48" cy="42" rx="12" ry="10" fill="url(#a4b)"/>
<path d="M26 40c0-4 4-6 24-6s24 2 24 6l5 38c1 6-4 9-29 9s-30-3-29-9z" fill="url(#a4)"/>
<path d="M27 47h46M29 61h42M31 75h38" stroke="#7E6238" stroke-width="1.2" opacity=".35"/>
<path d="M26 40c8 5 40 5 48 0" stroke="#7E6238" stroke-width="2" fill="none" opacity=".45"/></svg>`,

p5:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a5" cx="35%" cy="30%"><stop offset="0" stop-color="#E3A6A8"/><stop offset="1" stop-color="#8E3348"/></radialGradient></defs>${SH}
<path d="M28 34c0-5 5-8 22-8s22 3 22 8l4 40c0 8-8 12-26 12s-26-4-26-12z" fill="url(#a5)"/>
<circle cx="40" cy="46" r="9" fill="#C4676F" opacity=".55"/><circle cx="60" cy="44" r="9" fill="#C4676F" opacity=".55"/><circle cx="50" cy="62" r="10" fill="#C4676F" opacity=".5"/><circle cx="36" cy="70" r="8" fill="#C4676F" opacity=".45"/><circle cx="64" cy="70" r="8" fill="#C4676F" opacity=".45"/>
<path d="M30 34h44M31 45h42M32 56h40M33 67h38M34 78h36M38 30v54M50 27v58M62 30v54" stroke="#F5E9DC" stroke-width="1.3" opacity=".5" fill="none"/>
<path d="M28 34c8 4 36 4 44 0" stroke="#6B2436" stroke-width="2.2" fill="none" opacity=".5"/></svg>`,

/* ---------- SABZI ---------- */
p6:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a6" cx="34%" cy="30%"><stop offset="0" stop-color="#F4634A"/><stop offset=".6" stop-color="#DC2F1E"/><stop offset="1" stop-color="#9E1810"/></radialGradient></defs>${SH}
<path d="M50 26c18 0 31 13 31 29S68 85 50 85 19 71 19 55s13-29 31-29z" fill="url(#a6)"/>
<path d="M50 30c-4 7-6 16-6 25s2 18 6 26M64 34c3 7 5 14 5 21 0 9-2 18-6 25" stroke="#B01E13" stroke-width="1.4" fill="none" opacity=".3"/>
<path d="M50 16c1 5 1 8 0 12M50 28c-6-2-11-6-13-11 6 0 11 3 13 6 2-3 7-6 13-6-2 5-7 9-13 11z" fill="#4E9A38"/>
<path d="M50 28c-4-4-9-6-14-6 2 5 8 8 14 8s12-3 14-8c-5 0-10 2-14 6z" fill="#5FAE44"/>
<path d="M50 14c-1 0-2 1-2 3v5h4v-5c0-2-1-3-2-3z" fill="#3F7F2C"/>
<ellipse cx="37" cy="42" rx="8" ry="12" fill="#fff" opacity=".26" transform="rotate(-25 37 42)"/></svg>`,

p7:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a7" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93C954"/><stop offset="1" stop-color="#4E8A28"/></linearGradient></defs>${SH}
<g transform="rotate(-16 50 52)">
<path d="M42 24h16l3 10c2 8 3 22 3 32 0 12-4 18-14 18s-14-6-14-18c0-10 1-24 3-32z" fill="url(#a7)"/>
<path d="M50 34v48M43 36c-1 12-2 26-1 38M57 36c1 12 2 26 1 38" stroke="#3E7220" stroke-width="1.3" fill="none" opacity=".55"/>
<path d="M42 24c2-6 5-9 8-9s6 3 8 9c-3 2-13 2-16 0z" fill="#4E8A28"/>
<path d="M50 15v-6" stroke="#3E7220" stroke-width="2.4" stroke-linecap="round"/></g>
<g transform="rotate(14 60 56) translate(12 4) scale(.86)">
<path d="M42 24h16l3 10c2 8 3 22 3 32 0 12-4 18-14 18s-14-6-14-18c0-10 1-24 3-32z" fill="url(#a7)" opacity=".92"/>
<path d="M50 34v48" stroke="#3E7220" stroke-width="1.3" fill="none" opacity=".5"/>
<path d="M42 24c2-6 5-9 8-9s6 3 8 9c-3 2-13 2-16 0z" fill="#4E8A28"/></g></svg>`,

p8:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a8" cx="34%" cy="26%"><stop offset="0" stop-color="#9C63C4"/><stop offset=".55" stop-color="#6B2E93"/><stop offset="1" stop-color="#3B1454"/></radialGradient></defs>${SH}
<path d="M50 30c17 0 27 13 27 28 0 16-11 27-27 27S23 74 23 58c0-15 10-28 27-28z" fill="url(#a8)"/>
<path d="M50 30c-2-6-3-10-2-14 4 1 6 4 6 8" fill="none" stroke="#4A8A2E" stroke-width="3.4" stroke-linecap="round"/>
<path d="M50 32c-7-3-12-8-13-14 6 1 11 4 13 8 2-4 7-7 13-8-1 6-6 11-13 14z" fill="#5FA53B"/>
<path d="M40 28c-4-2-7-5-8-9 4 0 8 2 10 5M60 28c4-2 7-5 8-9-4 0-8 2-10 5" fill="#4A8A2E"/>
<ellipse cx="38" cy="46" rx="7" ry="13" fill="#fff" opacity=".24" transform="rotate(-22 38 46)"/></svg>`,

p9:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a9" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C6E08C"/><stop offset=".55" stop-color="#9CC456"/><stop offset="1" stop-color="#5F8E2C"/></linearGradient></defs>${SH}
<path d="M50 20c5 0 8 4 8 10 0 8-4 12-4 18 0 8 12 12 12 26 0 11-7 18-16 18s-16-7-16-18c0-14 12-18 12-26 0-6-4-10-4-18 0-6 3-10 8-10z" fill="url(#a9)"/>
<path d="M50 24v58" stroke="#5F8E2C" stroke-width="1.2" fill="none" opacity=".35"/>
<path d="M50 20c-1-4-1-7 0-9 1 2 1 5 0 9z" fill="#4A7522"/>
<ellipse cx="43" cy="66" rx="6" ry="11" fill="#fff" opacity=".28" transform="rotate(-12 43 66)"/>
<ellipse cx="46" cy="32" rx="3" ry="6" fill="#fff" opacity=".3"/></svg>`,

p10:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a10" cx="40%" cy="30%"><stop offset="0" stop-color="#FFFDF4"/><stop offset="1" stop-color="#E2D8B8"/></radialGradient></defs>${SH}
<path d="M20 60c-4-8 2-14 8-14-2-8 6-14 13-11 2-8 12-10 17-4 5-8 17-4 18 5 8-1 13 7 9 14 7 2 9 10 4 15z" fill="#63A83C"/>
<path d="M24 56c0-16 12-26 26-26s26 10 26 26c0 12-11 18-26 18s-26-6-26-18z" fill="url(#a10)"/>
<circle cx="36" cy="47" r="8" fill="#fff" opacity=".55"/><circle cx="52" cy="41" r="9" fill="#fff" opacity=".5"/><circle cx="65" cy="50" r="8" fill="#fff" opacity=".45"/><circle cx="44" cy="59" r="8" fill="#fff" opacity=".4"/><circle cx="60" cy="62" r="7" fill="#fff" opacity=".38"/>
<path d="M24 58c6 10 46 10 52 0 2 10-8 22-26 22s-28-12-26-22z" fill="#7ABF4C"/>
<path d="M32 62c2 8 4 13 7 17M50 66v16M68 62c-2 8-4 13-7 17" stroke="#4E8A28" stroke-width="1.6" fill="none" opacity=".55"/></svg>`,

p11:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a11" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FC24A"/><stop offset="1" stop-color="#2F6B1C"/></linearGradient></defs>${SH}
<path d="M50 84c-6-14-6-28-2-40 3 12 3 26 2 40z" fill="#4E8A28"/>
<path d="M50 80C36 78 24 66 22 50c14-4 27 4 32 18 2 5 0 10-4 12z" fill="url(#a11)"/>
<path d="M50 80c14-2 26-14 28-30-14-4-27 4-32 18-2 5 0 10 4 12z" fill="url(#a11)" opacity=".92"/>
<path d="M48 78C40 68 32 60 24 54M52 78c8-10 16-18 24-24" stroke="#2F6B1C" stroke-width="1.3" fill="none" opacity=".5"/>
<path d="M50 62c-8-10-16-14-24-16M50 62c8-10 16-14 24-16" stroke="#2F6B1C" stroke-width="1" fill="none" opacity=".35"/>
<path d="M50 74c-10-2-18-10-22-20 10 0 19 8 22 20z" fill="#93D45E" opacity=".55"/>
<path d="M44 88c4-4 8-4 12 0-4 3-8 3-12 0z" fill="#C9B79E"/></svg>`,

p12:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V50M50 62c-8-6-14-10-20-12M50 56c8-6 14-10 20-12M50 74c-6-4-11-6-16-7" stroke="#3E7A24" stroke-width="2" fill="none" stroke-linecap="round"/>
<g fill="#66B23A">
<path d="M50 50c-5-8-4-16 2-20 5 4 6 12 1 20z"/>
<path d="M30 38c-9 0-15-5-15-11 8-2 15 2 17 9zM26 50c-9 1-16-3-17-9 7-3 15 0 18 7z"/>
<path d="M70 26c9 0 15-5 15-11-8-2-15 2-17 9zM74 38c9 1 16-3 17-9-7-3-15 0-18 7z"/>
<path d="M34 67c-8 2-15-1-17-7 7-3 15-1 18 5z"/></g>
<g fill="#8ACF56" opacity=".8">
<path d="M50 44c-3-5-3-10 1-13 3 3 4 8 1 13zM30 40c-6 0-10-3-10-7 5-1 10 1 11 6zM70 28c6 0 10-3 10-7-5-1-10 1-11 6z"/></g></svg>`,

p13:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a13" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FD14A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M38 22c-4 0-6 3-6 7 0 12 4 28 8 40 3 9 8 14 13 14 6 0 9-5 9-12 0-14-6-32-12-42-3-5-7-7-12-7z" fill="url(#a13)" transform="rotate(-10 50 55)"/>
<path d="M40 30c2 12 6 30 11 42" stroke="#2E6117" stroke-width="1.4" fill="none" opacity=".45" transform="rotate(-10 50 55)"/>
<path d="M32 26c-2-6-1-10 3-12 3 4 3 9 0 13" fill="#3E7A20" transform="rotate(-10 50 55)"/>
<g transform="rotate(20 62 58) translate(14 2) scale(.82)">
<path d="M38 22c-4 0-6 3-6 7 0 12 4 28 8 40 3 9 8 14 13 14 6 0 9-5 9-12 0-14-6-32-12-42-3-5-7-7-12-7z" fill="url(#a13)" opacity=".9"/>
<path d="M32 26c-2-6-1-10 3-12 3 4 3 9 0 13" fill="#3E7A20"/></g></svg>`,

p14:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a14" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFA53D"/><stop offset=".55" stop-color="#F07A15"/><stop offset="1" stop-color="#C2530A"/></linearGradient></defs>${SH}
<path d="M44 82c-6-6-9-16-9-28 0-12 5-22 8-24l14 3c2 3 4 12 3 22-1 13-6 24-11 28-2 2-4 2-5-1z" fill="url(#a14)"/>
<path d="M40 40c4 2 12 3 18 1M39 52c5 2 13 3 18 1M41 64c4 2 10 2 14 1M44 74c3 1 7 1 9 0" stroke="#B44C08" stroke-width="1.3" fill="none" opacity=".45"/>
<path d="M50 30c-4-8-10-12-17-12 2 7 8 12 17 12zM50 30c2-9 8-14 15-15-1 8-6 14-15 15zM50 30c0-9 3-15 8-19 2 8 0 15-8 19z" fill="#57A032"/>
<path d="M50 32c-3-6-7-9-12-10 2 5 6 9 12 10z" fill="#79C24C"/>
<ellipse cx="45" cy="50" rx="3" ry="14" fill="#fff" opacity=".22"/></svg>`,

p15:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a15" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EA83A"/><stop offset=".5" stop-color="#33741F"/><stop offset="1" stop-color="#1E4F13"/></linearGradient></defs>${SH}
<g transform="rotate(-24 50 52)">
<rect x="36" y="18" width="28" height="66" rx="14" fill="url(#a15)"/>
<path d="M42 24v54M50 20v64M58 24v54" stroke="#1E4F13" stroke-width="1.2" fill="none" opacity=".4"/>
<circle cx="45" cy="34" r="1.6" fill="#B7DE86" opacity=".8"/><circle cx="55" cy="44" r="1.6" fill="#B7DE86" opacity=".8"/>
<circle cx="44" cy="56" r="1.6" fill="#B7DE86" opacity=".8"/><circle cx="56" cy="66" r="1.6" fill="#B7DE86" opacity=".8"/>
<circle cx="50" cy="26" r="1.4" fill="#B7DE86" opacity=".7"/><circle cx="49" cy="74" r="1.4" fill="#B7DE86" opacity=".7"/>
<ellipse cx="43" cy="40" rx="3" ry="14" fill="#fff" opacity=".18"/>
<path d="M50 18c0-4 2-6 4-6" stroke="#2E6117" stroke-width="2.6" fill="none" stroke-linecap="round"/></g></svg>`,

p16:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a16" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FCB55"/><stop offset="1" stop-color="#4A8A28"/></linearGradient></defs>${SH}
<path d="M22 40c8-8 20-12 30-12s22 4 30 12c-6 14-18 24-30 24S28 54 22 40z" fill="#3E7A20"/>
<path d="M24 42c8-7 18-10 26-10s18 3 26 10c-5 12-16 20-26 20S29 54 24 42z" fill="url(#a16)"/>
<circle cx="35" cy="46" r="7.5" fill="#A8DB6A"/><circle cx="50" cy="49" r="8" fill="#A8DB6A"/><circle cx="65" cy="46" r="7.5" fill="#A8DB6A"/>
<circle cx="33" cy="43" r="2.5" fill="#fff" opacity=".45"/><circle cx="48" cy="46" r="2.6" fill="#fff" opacity=".45"/><circle cx="63" cy="43" r="2.5" fill="#fff" opacity=".45"/>
<path d="M22 40c10 12 20 18 28 18s18-6 28-18c2 12-10 26-28 26S20 52 22 40z" fill="#57A032"/>
<path d="M78 28c4-6 8-9 12-9-1 6-5 10-12 11z" fill="#57A032"/>
<path d="M82 30c-2 3-4 5-6 6" stroke="#3E7A20" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,

p17:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a17" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DC245"/><stop offset=".5" stop-color="#4B9426"/><stop offset="1" stop-color="#2C6316"/></linearGradient></defs>${SH}
<path d="M34 32c-8 4-12 14-12 24 0 16 12 28 28 28s28-12 28-28c0-10-4-20-12-24-4 3-10 4-16 4s-12-1-16-4z" fill="url(#a17)"/>
<path d="M38 36c-3 12-3 32 2 44M62 36c3 12 3 32-2 44" stroke="#255313" stroke-width="1.6" fill="none" opacity=".45"/>
<path d="M50 30c-8 0-14 2-16 4 3 4 9 6 16 6s13-2 16-6c-2-2-8-4-16-4z" fill="#3E7A20"/>
<path d="M50 30c-1-6-1-10 0-14 1 4 1 8 0 14z" fill="#2C6316"/>
<path d="M48 16c-1-3 0-5 2-6 2 1 3 3 2 6z" fill="#3E7A20"/>
<ellipse cx="35" cy="52" rx="4" ry="15" fill="#fff" opacity=".2"/></svg>`,

p18:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a18" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#84BE3F"/><stop offset="1" stop-color="#3B7A1C"/></linearGradient></defs>${SH}
<g transform="rotate(-14 50 52)">
<path d="M50 16c-9 0-15 8-16 20-1 10-1 24 1 34 2 10 8 16 15 16s13-6 15-16c2-10 2-24 1-34-1-12-7-20-16-20z" fill="url(#a18)"/>
<path d="M42 22c-2 14-3 34-1 48M50 18v66M58 22c2 14 3 34 1 48" stroke="#2E6117" stroke-width="1.5" fill="none" opacity=".5"/>
<g fill="#9FD25C"><ellipse cx="44" cy="32" rx="3" ry="5"/><ellipse cx="56" cy="38" rx="3" ry="5"/><ellipse cx="43" cy="48" rx="3" ry="5"/><ellipse cx="57" cy="56" rx="3" ry="5"/><ellipse cx="45" cy="64" rx="3" ry="4"/><ellipse cx="54" cy="72" rx="2.6" ry="4"/><ellipse cx="50" cy="26" rx="2.6" ry="4"/></g>
<path d="M50 16c0-4 1-7 3-8" stroke="#2E6117" stroke-width="2.6" fill="none" stroke-linecap="round"/></g></svg>`,

p19:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a19" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#78B93C"/><stop offset="1" stop-color="#33701A"/></linearGradient></defs>${SH}
<g transform="rotate(-22 50 52)">
<path d="M50 14c-8 0-12 6-13 16-2 16-2 40 0 50 1 8 6 12 13 12s12-4 13-12c2-10 2-34 0-50-1-10-5-16-13-16z" fill="url(#a19)"/>
<path d="M50 14v78M40 20c-2 16-2 44 0 60M60 20c2 16 2 44 0 60M45 16c-1 18-1 44 0 62M55 16c1 18 1 44 0 62" stroke="#245311" stroke-width="1.6" fill="none" opacity=".55"/>
<path d="M50 12c1-4 3-6 5-6" stroke="#245311" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<ellipse cx="43" cy="45" rx="2.6" ry="20" fill="#fff" opacity=".16"/></g></svg>`,

/* ---------- FRUITS ---------- */
p20:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a20" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE066"/><stop offset=".55" stop-color="#F5C120"/><stop offset="1" stop-color="#C99206"/></linearGradient></defs>${SH}
<g transform="rotate(6 50 55)">
<path d="M26 34c-3 20 6 42 26 46 16 3 24-6 25-12-14 2-26-4-33-14-6-9-9-16-9-22-4 0-8 1-9 2z" fill="#D9A312"/>
<path d="M30 30c-4 20 6 40 26 44 14 3 22-4 23-10-13 2-25-3-32-13-6-9-9-15-9-21-3 0-7 0-8 0z" fill="url(#a20)"/>
<path d="M32 34c-2 16 6 32 22 37" stroke="#B98307" stroke-width="1.5" fill="none" opacity=".5"/>
<path d="M30 30c-1-5 1-8 4-9 2 3 2 6 1 9z" fill="#5E7A2A"/>
<path d="M79 64c4 1 6 3 6 6-3 1-6 0-8-2z" fill="#3E4E1C"/>
<path d="M20 40c-3 18 6 38 24 43 5 1 9 1 12 0-16-2-28-14-32-30-2-6-3-10-4-13z" fill="#E8B317" opacity=".9"/></g></svg>`,

p21:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a21" cx="34%" cy="28%"><stop offset="0" stop-color="#F0543E"/><stop offset=".55" stop-color="#CE2419"/><stop offset="1" stop-color="#8C120F"/></radialGradient></defs>${SH}
<path d="M50 28c-4-4-10-6-16-4-8 3-12 12-12 22 0 18 12 38 22 38 3 0 5-1 6-2 1 1 3 2 6 2 10 0 22-20 22-38 0-10-4-19-12-22-6-2-12 0-16 4z" fill="url(#a21)"/>
<path d="M50 28v56" stroke="#8C120F" stroke-width="1.2" fill="none" opacity=".22"/>
<path d="M50 26c-1-6-1-10 0-14 1 4 1 8 0 14z" fill="#6B4A26"/>
<path d="M52 18c6-6 13-7 18-4-3 7-11 10-18 8z" fill="#4E9A38"/>
<path d="M53 19c5-4 10-5 14-4-3 4-9 6-14 4z" fill="#6FBD50"/>
<ellipse cx="36" cy="44" rx="7" ry="13" fill="#fff" opacity=".28" transform="rotate(-24 36 44)"/></svg>`,

p22:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a22" cx="34%" cy="30%"><stop offset="0" stop-color="#FFB245"/><stop offset=".6" stop-color="#F5820B"/><stop offset="1" stop-color="#BE5504"/></radialGradient></defs>${SH}
<circle cx="50" cy="55" r="30" fill="url(#a22)"/>
<g fill="#C25E05" opacity=".28"><circle cx="40" cy="42" r="1.6"/><circle cx="54" cy="38" r="1.5"/><circle cx="64" cy="50" r="1.6"/><circle cx="44" cy="60" r="1.5"/><circle cx="58" cy="66" r="1.6"/><circle cx="35" cy="54" r="1.4"/><circle cx="50" cy="52" r="1.4"/><circle cx="62" cy="36" r="1.3"/><circle cx="38" cy="70" r="1.4"/></g>
<path d="M50 25c-1-4-1-7 0-9 1 2 1 5 0 9z" fill="#6B4A26"/>
<path d="M52 20c6-7 14-8 19-5-4 7-12 10-19 5z" fill="#4E9A38"/>
<path d="M53 20c5-4 10-6 14-5-3 4-9 7-14 5z" fill="#6FBD50"/>
<ellipse cx="38" cy="43" rx="7" ry="10" fill="#fff" opacity=".3" transform="rotate(-25 38 43)"/></svg>`,

p23:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a23" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D3D96A"/><stop offset="1" stop-color="#8FA83A"/></linearGradient><radialGradient id="a23b" cx="45%" cy="40%"><stop offset="0" stop-color="#FFA94D"/><stop offset="1" stop-color="#E86A11"/></radialGradient></defs>${SH}
<path d="M50 16c-14 0-24 16-24 38s10 32 24 32 24-10 24-32-10-38-24-38z" fill="url(#a23)"/>
<path d="M50 18c-10 0-17 15-17 36s7 30 17 30z" fill="url(#a23b)"/>
<path d="M50 20c-7 0-12 14-12 34 0 8 1 15 3 20" fill="#FFC98A" opacity=".5"/>
<g fill="#3E2A14"><ellipse cx="44" cy="42" rx="2.4" ry="2.9"/><ellipse cx="44" cy="52" rx="2.4" ry="2.9"/><ellipse cx="44" cy="62" rx="2.4" ry="2.9"/><ellipse cx="44" cy="72" rx="2.2" ry="2.6"/><ellipse cx="38" cy="47" rx="2.2" ry="2.6"/><ellipse cx="38" cy="57" rx="2.2" ry="2.6"/><ellipse cx="38" cy="67" rx="2" ry="2.4"/></g>
<path d="M50 16c0-4 1-7 3-8" stroke="#5E7A2A" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,

p24:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a24" cx="34%" cy="30%"><stop offset="0" stop-color="#A76FC9"/><stop offset=".6" stop-color="#6B3391"/><stop offset="1" stop-color="#3D1657"/></radialGradient></defs>${SH}
<path d="M50 22c-2-6-6-9-11-10 4 6 8 9 11 12z" fill="#5E7A2A"/>
<path d="M52 24c6-8 14-11 20-9-4 8-12 12-20 11z" fill="#4E9A38"/>
<g fill="url(#a24)">
<circle cx="50" cy="34" r="9"/><circle cx="38" cy="45" r="9"/><circle cx="62" cy="45" r="9"/>
<circle cx="50" cy="50" r="9"/><circle cx="30" cy="58" r="8.5"/><circle cx="70" cy="58" r="8.5"/>
<circle cx="42" cy="62" r="9"/><circle cx="58" cy="62" r="9"/><circle cx="50" cy="74" r="8.5"/>
<circle cx="36" cy="76" r="7.5"/><circle cx="64" cy="76" r="7.5"/></g>
<g fill="#fff" opacity=".3"><circle cx="47" cy="31" r="2.6"/><circle cx="35" cy="42" r="2.6"/><circle cx="59" cy="42" r="2.6"/><circle cx="39" cy="59" r="2.6"/><circle cx="55" cy="59" r="2.6"/><circle cx="47" cy="71" r="2.4"/></g></svg>`,

p25:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a25" cx="34%" cy="30%"><stop offset="0" stop-color="#5FAE3E"/><stop offset=".6" stop-color="#2E7A22"/><stop offset="1" stop-color="#174913"/></radialGradient></defs>${SH}
<circle cx="50" cy="54" r="31" fill="url(#a25)"/>
<path d="M28 34c4 14 4 28 0 40M40 24c-4 18-4 42 0 60M60 24c4 18 4 42 0 60M72 34c-4 14-4 28 0 40" stroke="#174913" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>
<path d="M50 23v62" stroke="#174913" stroke-width="4" fill="none" opacity=".4"/>
<path d="M64 32a31 31 0 0 1 8 30l-38 12a31 31 0 0 1 30-42z" fill="none"/>
<path d="M50 54 78 40a31 31 0 0 1 0 28z" fill="#E33F42"/>
<path d="M50 54 78 40a31 31 0 0 1 0 28z" fill="none" stroke="#FBF3D9" stroke-width="2.4"/>
<g fill="#3B1A12"><circle cx="66" cy="48" r="1.7"/><circle cx="70" cy="56" r="1.7"/><circle cx="63" cy="58" r="1.6"/></g>
<ellipse cx="37" cy="40" rx="8" ry="11" fill="#fff" opacity=".16" transform="rotate(-25 37 40)"/></svg>`,

p26:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a26" cx="36%" cy="30%"><stop offset="0" stop-color="#DCE87F"/><stop offset=".6" stop-color="#A9C441"/><stop offset="1" stop-color="#6C8A24"/></radialGradient></defs>${SH}
<path d="M50 24c-16 0-27 14-27 31 0 16 11 27 27 27s27-11 27-27c0-17-11-31-27-31z" fill="url(#a26)"/>
<path d="M50 24c-3 8-4 16-4 24" stroke="#89A62F" stroke-width="1.3" fill="none" opacity=".4"/>
<path d="M50 22c-1-5-1-8 0-11 1 3 1 6 0 11z" fill="#6B4A26"/>
<path d="M52 16c6-6 13-7 18-5-3 7-11 10-18 5z" fill="#4E9A38"/>
<path d="M48 16c-5-5-11-6-15-4 3 6 9 8 15 4z" fill="#3E7A20"/>
<ellipse cx="37" cy="44" rx="7" ry="11" fill="#fff" opacity=".3" transform="rotate(-24 37 44)"/></svg>`,

p27:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a27" cx="34%" cy="28%"><stop offset="0" stop-color="#E86B57"/><stop offset=".55" stop-color="#C42B26"/><stop offset="1" stop-color="#801419"/></radialGradient></defs>${SH}
<circle cx="50" cy="56" r="30" fill="url(#a27)"/>
<path d="M50 26c-4 0-6-3-7-8 3 2 5 2 7 1 2 1 4 1 7-1-1 5-3 8-7 8z" fill="#9E1A1C"/>
<path d="M44 18c1 4 3 6 6 6s5-2 6-6c-2 2-4 3-6 3s-4-1-6-3z" fill="#B02223"/>
<path d="M42 15l3 6M50 13l0 7M58 15l-3 6" stroke="#9E1A1C" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M36 42c4 14 4 26 0 36M64 42c-4 14-4 26 0 36" stroke="#9E1A1C" stroke-width="1.4" fill="none" opacity=".3"/>
<ellipse cx="37" cy="45" rx="7" ry="12" fill="#fff" opacity=".24" transform="rotate(-24 37 45)"/></svg>`,

p28:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a28" cx="34%" cy="28%"><stop offset="0" stop-color="#FFB255"/><stop offset=".55" stop-color="#F2860F"/><stop offset="1" stop-color="#B85C0A"/></radialGradient></defs>${SH}
<path d="M50 30c-3-6-2-11 2-15 2 4 1 9-2 15z" fill="#5F8E2C"/>
<path d="M50 32c15 0 25 13 25 27 0 16-11 27-25 27S25 75 25 59c0-14 10-27 25-27z" fill="url(#a28)"/>
<path d="M50 32v54M38 34c-3 8-4 17-4 25s1 17 4 25M62 34c3 8 4 17 4 25s-1 17-4 25" stroke="#B85C0A" stroke-width="1.4" fill="none" opacity=".4"/>
<ellipse cx="38" cy="48" rx="7" ry="12" fill="#fff" opacity=".26" transform="rotate(-20 38 48)"/></svg>`,

p29:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a29" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C97D5C"/><stop offset=".55" stop-color="#9B4E33"/><stop offset="1" stop-color="#6B2E1B"/></linearGradient></defs>${SH}
<path d="M28 58c-2-10 4-20 14-24 10-3 20 0 26 8 5 7 5 17 0 25-6 9-17 13-27 9-8-3-12-10-13-18z" fill="url(#a29)"/>
<path d="M32 48c8-2 16-1 22 4M30 60c9 1 18 3 26 8" stroke="#6B2E1B" stroke-width="1.3" fill="none" opacity=".4"/>
<ellipse cx="38" cy="48" rx="6" ry="10" fill="#fff" opacity=".24" transform="rotate(-25 38 48)"/></svg>`,

p30:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a30" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D2B48C"/><stop offset=".55" stop-color="#A67B4F"/><stop offset="1" stop-color="#6E4A26"/></linearGradient></defs>${SH}
<path d="M50 26c8 0 12 8 12 18 0 8-3 12-3 22 0 10 6 12 6 20 0 6-6 10-15 10s-15-4-15-10c0-8 6-10 6-20 0-10-3-14-3-22 0-10 4-18 12-18z" fill="url(#a30)"/>
<path d="M50 30c-3 8-3 16 0 24M50 30c3 8 3 16 0 24" stroke="#6E4A26" stroke-width="1.2" fill="none" opacity=".4"/>
<ellipse cx="43" cy="42" rx="5" ry="10" fill="#fff" opacity=".26"/></svg>`,

p31:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a31" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D8C29C"/><stop offset=".55" stop-color="#AD8A56"/><stop offset="1" stop-color="#785E34"/></linearGradient></defs>${SH}
<path d="M50 22c14 0 22 12 22 28 0 20-10 34-22 34S28 70 28 50c0-16 8-28 22-28z" fill="url(#a31)"/>
<path d="M38 34c6-4 18-4 24 0M35 50h30M38 66c6 4 18 4 24 0" stroke="#785E34" stroke-width="1.3" fill="none" opacity=".38"/>
<ellipse cx="41" cy="40" rx="7" ry="12" fill="#fff" opacity=".24" transform="rotate(-16 41 40)"/></svg>`,

p32:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a32" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M50 22c8 0 13 6 13 16 0 22-4 40-13 46-9-6-13-24-13-46 0-10 5-16 13-16z" fill="url(#a32)"/>
<path d="M42 30c3 20 3 34 0 50M58 30c-3 20-3 34 0 50" stroke="#EAF4CE" stroke-width="1.1" fill="none" opacity=".55"/>
<path d="M50 22c-1-4-1-7 0-9 1 2 1 5 0 9z" fill="#4A7522"/>
<ellipse cx="44" cy="40" rx="4" ry="12" fill="#fff" opacity=".26"/></svg>`,

p33:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a33" cx="34%" cy="30%"><stop offset="0" stop-color="#AEDD6E"/><stop offset=".55" stop-color="#7CB43F"/><stop offset="1" stop-color="#4E8022"/></radialGradient></defs>${SH}
<path d="M50 26c16 0 26 12 26 26S66 78 50 78 24 66 24 52 34 26 50 26z" fill="url(#a33)"/>
<path d="M50 30c0 16 0 32 0 44M32 40c8 6 14 12 18 24M68 40c-8 6-14 12-18 24" stroke="#4E8022" stroke-width="1.2" fill="none" opacity=".4"/>
<path d="M50 26c-1-4-1-6 0-8 1 2 1 4 0 8z" fill="#3E6B1C"/>
<ellipse cx="40" cy="42" rx="7" ry="11" fill="#fff" opacity=".28" transform="rotate(-20 40 42)"/></svg>`,

p34:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a34" cx="34%" cy="30%"><stop offset="0" stop-color="#C43A6B"/><stop offset=".55" stop-color="#8E1F42"/><stop offset="1" stop-color="#5C1029"/></radialGradient></defs>${SH}
<path d="M50 28c14 0 24 11 24 25S64 78 50 78 26 65 26 53s10-25 24-25z" fill="url(#a34)"/>
<path d="M50 30c-6 8-8 18-4 46M50 30c6 8 8 18 4 46" stroke="#5C1029" stroke-width="1.2" fill="none" opacity=".4"/>
<path d="M46 28c-4-5-9-8-14-8 2 6 8 9 14 8zM54 28c4-5 9-8 14-8-2 6-8 9-14 8z" fill="#5F8E2C"/>
<ellipse cx="40" cy="42" rx="7" ry="11" fill="#fff" opacity=".26" transform="rotate(-20 40 42)"/></svg>`,

p35:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a35" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDFBF4"/><stop offset=".6" stop-color="#F1EEE0"/><stop offset="1" stop-color="#D8D3BF"/></linearGradient></defs>${SH}
<path d="M50 30c6 0 10 5 10 13 0 20-4 34-10 42-6-8-10-22-10-42 0-8 4-13 10-13z" fill="url(#a35)"/>
<path d="M50 34v46" stroke="#C9C3AA" stroke-width="1.1" fill="none" opacity=".5"/>
<path d="M50 30c-5-6-13-9-20-7 3 8 12 12 20 7zM50 30c5-6 13-9 20-7-3 8-12 12-20 7z" fill="#6CA83A"/>
<ellipse cx="45" cy="46" rx="4" ry="14" fill="#fff" opacity=".5"/></svg>`,

p36:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a36" cx="34%" cy="30%"><stop offset="0" stop-color="#C6E39A"/><stop offset=".55" stop-color="#8FC15A"/><stop offset="1" stop-color="#5A8E30"/></radialGradient></defs>${SH}
<path d="M50 22c17 0 29 13 29 29S67 80 50 80 21 67 21 51s12-29 29-29z" fill="url(#a36)"/>
<path d="M50 26c14 0 24 11 24 25S64 76 50 76 26 65 26 51 36 26 50 26z" fill="#A6D274" opacity=".7"/>
<path d="M50 30c11 0 19 9 19 21S61 72 50 72s-19-9-19-21 8-21 19-21z" fill="#BEE28C" opacity=".7"/>
<ellipse cx="39" cy="40" rx="8" ry="13" fill="#fff" opacity=".26" transform="rotate(-20 39 40)"/></svg>`,

p37:`<svg viewBox="0 0 100 100">${SH}
<path d="M38 86V44M50 86V38M62 86V44" stroke="#5F8E2C" stroke-width="4" fill="none" stroke-linecap="round"/>
<ellipse cx="38" cy="42" rx="7" ry="10" fill="#EAE3D2"/>
<ellipse cx="50" cy="36" rx="8" ry="11" fill="#F4EEE0"/>
<ellipse cx="62" cy="42" rx="7" ry="10" fill="#EAE3D2"/>
<path d="M38 32c0-5 1-8 4-10M50 26c0-5 1-9 4-11M62 32c0-5 1-8 4-10" stroke="#7BAE4E" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="48" cy="34" rx="3" ry="5" fill="#fff" opacity=".4"/></svg>`,

p38:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a38" x1="0" y1="0" x2="1" y2=".8"><stop offset="0" stop-color="#E8CE9E"/><stop offset=".55" stop-color="#C9A465"/><stop offset="1" stop-color="#9C7A42"/></linearGradient></defs>${SH}
<path d="M30 62c-4-10 2-20 12-22 4-8 14-10 20-4 8-2 16 4 16 14 0 8-6 14-14 14-2 6-10 10-16 6-8 4-16-1-18-8z" fill="url(#a38)"/>
<path d="M36 46c4 6 10 8 16 6M52 40c4 6 10 8 16 8" stroke="#9C7A42" stroke-width="1.2" fill="none" opacity=".4"/>
<ellipse cx="42" cy="48" rx="6" ry="9" fill="#fff" opacity=".24" transform="rotate(-20 42 48)"/></svg>`,

p39:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a39" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M20 46c6-6 14-8 20-4 10-8 24-8 34 2 8 8 8 20 0 28-10 10-26 10-36 0-10 2-20-2-24-10-3-6-1-12 6-16z" fill="url(#a39)"/>
<path d="M26 50c10 2 20 8 28 16M32 44c10 0 22 6 30 14" stroke="#3E7A20" stroke-width="1.2" fill="none" opacity=".4"/>
<ellipse cx="34" cy="50" rx="6" ry="9" fill="#fff" opacity=".26" transform="rotate(-24 34 50)"/></svg>`,

p40:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a40" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE07A"/><stop offset=".55" stop-color="#F5C130"/><stop offset="1" stop-color="#D89A0E"/></linearGradient></defs>${SH}
<path d="M42 24c4-2 12-2 16 0 4 14 4 46 0 60-4 2-12 2-16 0-4-14-4-46 0-60z" fill="url(#a40)"/>
<g stroke="#D89A0E" stroke-width="1" opacity=".4">
<path d="M40 32h20M39 40h22M38 48h24M38 56h24M39 64h22M40 72h20"/></g>
<path d="M38 24c-8-4-16-3-22 2 5 6 14 8 22 2zM62 24c8-4 16-3 22 2-5 6-14 8-22 2z" fill="#5F8E2C"/>
<path d="M40 20c-6-6-14-8-20-6 3 7 11 11 20 6zM60 20c6-6 14-8 20-6-3 7-11 11-20 6z" fill="#7BAE4E"/>
<ellipse cx="46" cy="40" rx="3" ry="16" fill="#fff" opacity=".3"/></svg>`,

p41:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a41" cx="34%" cy="28%"><stop offset="0" stop-color="#A9D46B"/><stop offset=".55" stop-color="#77AC3E"/><stop offset="1" stop-color="#4A7A22"/></radialGradient></defs>${SH}
<path d="M50 20c17 0 28 15 28 32 0 19-13 32-28 32S22 71 22 52c0-17 11-32 28-32z" fill="url(#a41)"/>
<g fill="#4A7A22" opacity=".55">
<circle cx="38" cy="34" r="2.4"/><circle cx="50" cy="30" r="2.4"/><circle cx="62" cy="34" r="2.4"/>
<circle cx="30" cy="46" r="2.4"/><circle cx="44" cy="44" r="2.4"/><circle cx="58" cy="44" r="2.4"/><circle cx="70" cy="46" r="2.4"/>
<circle cx="36" cy="58" r="2.4"/><circle cx="50" cy="58" r="2.4"/><circle cx="64" cy="58" r="2.4"/>
<circle cx="42" cy="70" r="2.4"/><circle cx="58" cy="70" r="2.4"/></g>
<ellipse cx="38" cy="42" rx="8" ry="13" fill="#fff" opacity=".22" transform="rotate(-20 38 42)"/></svg>`,

p42:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V50M50 62c-8-6-14-10-20-12M50 56c8-6 14-10 20-12M50 74c-6-4-11-6-16-7M50 68c6-4 11-6 16-7" stroke="#3E7A24" stroke-width="2" fill="none" stroke-linecap="round"/>
<g fill="#79C24C">
<path d="M50 50c-4-7-3-14 2-18 4 4 4 11-2 18z"/>
<path d="M28 40c-8 0-13-4-13-10 7-2 13 2 15 8zM24 51c-8 1-14-2-15-8 6-3 13 0 17 6z"/>
<path d="M72 30c8 0 13-4 13-10-7-2-13 2-15 8zM76 41c8 1 14-2 15-8-6-3-13 0-17 6z"/>
<path d="M32 66c-7 2-13-1-15-6 6-3 13-1 16 4z"/></g>
<g fill="#9FDB6E" opacity=".7">
<path d="M50 44c-3-5-2-9 1-12 3 3 3 8-1 12zM30 44c-6 0-9-3-9-6 4-1 8 1 9 6zM70 34c6 0 9-3 9-6-4-1-8 1-9 6z"/></g></svg>`,

p43:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a43" cx="34%" cy="30%"><stop offset="0" stop-color="#B98A5E"/><stop offset=".55" stop-color="#8C6238"/><stop offset="1" stop-color="#5E3F1F"/></radialGradient></defs>${SH}
<path d="M50 28c15 0 25 12 25 26S65 80 50 80 25 66 25 54s10-26 25-26z" fill="url(#a43)"/>
<path d="M50 30c-1-4 0-7 2-9 1 3 1 6-2 9z" fill="#4A7522"/>
<ellipse cx="40" cy="44" rx="7" ry="11" fill="#fff" opacity=".22" transform="rotate(-20 40 44)"/></svg>`,

p44:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a44" cx="34%" cy="28%"><stop offset="0" stop-color="#F0736A"/><stop offset=".55" stop-color="#D33C34"/><stop offset="1" stop-color="#961F1A"/></radialGradient></defs>${SH}
<g>
<circle cx="40" cy="46" r="18" fill="url(#a44)"/>
<circle cx="64" cy="50" r="15" fill="url(#a44)"/>
<circle cx="46" cy="66" r="15" fill="url(#a44)"/>
</g>
<g fill="#961F1A" opacity=".35"><circle cx="34" cy="40" r="1.6"/><circle cx="44" cy="38" r="1.6"/><circle cx="40" cy="52" r="1.6"/>
<circle cx="62" cy="44" r="1.6"/><circle cx="68" cy="54" r="1.6"/><circle cx="42" cy="64" r="1.6"/><circle cx="52" cy="70" r="1.6"/></g>
<path d="M40 28c-2-5-1-9 2-12 3 3 3 8-2 12z" fill="#5F8E2C"/>
<ellipse cx="34" cy="40" rx="5" ry="8" fill="#fff" opacity=".3" transform="rotate(-20 34 40)"/></svg>`,

p45:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a45" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5D876"/><stop offset=".55" stop-color="#E0A934"/><stop offset="1" stop-color="#A9760F"/></linearGradient></defs>${SH}
<path d="M38 42c8-6 16-6 24 0 6 5 8 14 8 24 0 12-9 22-20 22s-20-10-20-22c0-10 2-19 8-24z" fill="url(#a45)"/>
<g stroke="#A9760F" stroke-width="1" opacity=".45">
<path d="M30 50c6-4 12-4 18 0M34 62c6-4 12-4 18 0M38 74c6-4 12-4 18 0M42 50c6-4 12-4 18 0M46 62c6-4 12-4 18 0M50 74c6-4 12-4 18 0"/></g>
<path d="M50 40c-6-10-16-14-26-12 4 10 16 16 26 12zM50 40c6-10 16-14 26-12-4 10-16 16-26 12z" fill="#5F8E2C"/>
<path d="M50 36c-4-8-11-12-18-11 3 8 11 13 18 11zM50 36c4-8 11-12 18-11-3 8-11 13-18 11z" fill="#7BAE4E"/>
<ellipse cx="42" cy="58" rx="6" ry="12" fill="#fff" opacity=".22"/></svg>`,

p46:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a46" cx="34%" cy="30%"><stop offset="0" stop-color="#D8E58A"/><stop offset=".55" stop-color="#A8C24E"/><stop offset="1" stop-color="#728A28"/></radialGradient></defs>${SH}
<path d="M50 24c5 0 8 5 8 11 0 4-2 6-2 9 10 2 18 12 18 25 0 15-11 25-24 25S26 74 26 59c0-13 8-23 18-25 0-3-2-5-2-9 0-6 3-11 8-11z" fill="url(#a46)"/>
<path d="M50 24c-1-4-1-7 1-9 1 2 1 5-1 9z" fill="#4A7522"/>
<ellipse cx="42" cy="56" rx="7" ry="12" fill="#fff" opacity=".26"/></svg>`,

p47:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a47" cx="34%" cy="30%"><stop offset="0" stop-color="#E8D390"/><stop offset=".55" stop-color="#C9AA55"/><stop offset="1" stop-color="#93762C"/></radialGradient></defs>${SH}
<circle cx="50" cy="54" r="30" fill="url(#a47)"/>
<g stroke="#93762C" stroke-width="1" fill="none" opacity=".45">
<path d="M22 46c10-6 46-6 56 0M20 54h60M22 62c10 6 46 6 56 0M32 30c-4 10-4 40 0 50M50 24c-4 10-4 56 0 62M68 30c4 10 4 40 0 50"/></g>
<path d="M50 24c-1-3-1-5 0-7 1 2 1 4 0 7z" fill="#5F8E2C"/>
<ellipse cx="40" cy="42" rx="8" ry="12" fill="#fff" opacity=".2" transform="rotate(-20 40 42)"/></svg>`,

p48:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a48" cx="34%" cy="30%"><stop offset="0" stop-color="#A9805A"/><stop offset=".55" stop-color="#7A5636"/><stop offset="1" stop-color="#4A3018"/></radialGradient></defs>${SH}
<circle cx="50" cy="54" r="28" fill="url(#a48)"/>
<g fill="#4A3018" opacity=".5"><circle cx="42" cy="42" r="1.6"/><circle cx="52" cy="38" r="1.6"/><circle cx="60" cy="46" r="1.6"/>
<circle cx="36" cy="52" r="1.6"/><circle cx="48" cy="50" r="1.6"/><circle cx="58" cy="56" r="1.6"/><circle cx="66" cy="52" r="1.6"/>
<circle cx="42" cy="64" r="1.6"/><circle cx="54" cy="66" r="1.6"/><circle cx="62" cy="62" r="1.6"/></g>
<circle cx="42" cy="46" r="6" fill="#2E1D0C"/><circle cx="56" cy="44" r="6" fill="#2E1D0C"/><circle cx="49" cy="56" r="6" fill="#2E1D0C"/>
<ellipse cx="38" cy="40" rx="6" ry="9" fill="#fff" opacity=".16" transform="rotate(-20 38 40)"/></svg>`,

p49:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a49" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C77B3E"/><stop offset=".55" stop-color="#9A551F"/><stop offset="1" stop-color="#63340F"/></linearGradient></defs>${SH}
<g>
<ellipse cx="36" cy="46" rx="12" ry="17" fill="url(#a49)" transform="rotate(-18 36 46)"/>
<ellipse cx="58" cy="52" rx="12" ry="18" fill="url(#a49)" transform="rotate(10 58 52)"/>
<ellipse cx="46" cy="68" rx="11" ry="16" fill="url(#a49)" transform="rotate(-6 46 68)"/>
</g>
<ellipse cx="32" cy="40" rx="4" ry="7" fill="#fff" opacity=".26" transform="rotate(-18 32 40)"/></svg>`,

p50:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a50" cx="34%" cy="28%"><stop offset="0" stop-color="#7B5A9E"/><stop offset=".55" stop-color="#4E3170"/><stop offset="1" stop-color="#2C1846"/></radialGradient></defs>${SH}
<path d="M50 26c14 0 24 12 24 27S64 82 50 82 26 68 26 53s10-27 24-27z" fill="url(#a50)"/>
<path d="M50 28c-1-4 0-7 2-9 1 3 0 6-2 9z" fill="#4A7522"/>
<ellipse cx="40" cy="42" rx="7" ry="11" fill="#fff" opacity=".24" transform="rotate(-20 40 42)"/></svg>`,

p51:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a51" cx="34%" cy="30%"><stop offset="0" stop-color="#D9DA7E"/><stop offset=".55" stop-color="#AEB240"/><stop offset="1" stop-color="#767A20"/></radialGradient></defs>${SH}
<circle cx="50" cy="54" r="26" fill="url(#a51)"/>
<path d="M50 28c-1-4 0-7 2-9 1 3 0 6-2 9z" fill="#4A7522"/>
<ellipse cx="40" cy="44" rx="7" ry="10" fill="#fff" opacity=".28" transform="rotate(-20 40 44)"/></svg>`,

p52:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a52" cx="34%" cy="26%"><stop offset="0" stop-color="#F4636E"/><stop offset=".55" stop-color="#DA1F35"/><stop offset="1" stop-color="#8E0F20"/></radialGradient></defs>${SH}
<path d="M50 30c14 0 22 12 22 24 0 16-12 30-22 30S28 70 28 54c0-12 8-24 22-24z" fill="url(#a52)"/>
<g fill="#F5D888" opacity=".8"><circle cx="42" cy="42" r="1.5"/><circle cx="54" cy="40" r="1.5"/><circle cx="62" cy="50" r="1.5"/>
<circle cx="36" cy="52" r="1.5"/><circle cx="48" cy="54" r="1.5"/><circle cx="58" cy="62" r="1.5"/>
<circle cx="42" cy="66" r="1.5"/><circle cx="52" cy="70" r="1.5"/></g>
<path d="M50 30c-6-6-16-8-24-4 2 8 14 12 24 4zM50 30c6-6 16-8 24-4-2 8-14 12-24 4z" fill="#5F8E2C"/>
<ellipse cx="40" cy="44" rx="6" ry="10" fill="#fff" opacity=".24" transform="rotate(-20 40 44)"/></svg>`,

p54:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a54" cx="34%" cy="30%"><stop offset="0" stop-color="#F5E3D8"/><stop offset=".55" stop-color="#D8B89C"/><stop offset="1" stop-color="#A9825F"/></radialGradient></defs>${SH}
<ellipse cx="50" cy="55" rx="34" ry="16" fill="url(#a54)"/>
<circle cx="30" cy="46" r="6" fill="url(#a54)"/><circle cx="70" cy="46" r="6" fill="url(#a54)"/>
<circle cx="24" cy="55" r="4" fill="#D8B89C"/><circle cx="76" cy="55" r="4" fill="#D8B89C"/>
<g stroke="#A9825F" stroke-width="1" opacity=".4"><circle cx="42" cy="52" r="2"/><circle cx="58" cy="50" r="2"/><circle cx="50" cy="60" r="2"/></g>
<ellipse cx="38" cy="46" rx="8" ry="4" fill="#fff" opacity=".3"/></svg>`,

p55:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a55" cx="34%" cy="28%"><stop offset="0" stop-color="#F3E6E0"/><stop offset=".55" stop-color="#D9BBAE"/><stop offset="1" stop-color="#8A5A47"/></radialGradient></defs>${SH}
<path d="M50 30c16 0 27 12 27 27S66 84 50 84 23 72 23 57s11-27 27-27z" fill="url(#a55)"/>
<path d="M40 24c-4-5-10-7-15-6 2 6 9 9 15 6zM60 24c4-5 10-7 15-6-2 6-9 9-15 6z" fill="#7BAE4E"/>
<path d="M50 28c-2-4-1-7 1-9 1 3 1 6-1 9z" fill="#5F8E2C"/>
<ellipse cx="40" cy="44" rx="8" ry="12" fill="#fff" opacity=".26" transform="rotate(-20 40 44)"/></svg>`,

p56:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a56" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D8BE93"/><stop offset=".55" stop-color="#AD8A56"/><stop offset="1" stop-color="#6E5230"/></linearGradient></defs>${SH}
<path d="M50 24c11 0 17 10 17 22 0 18-8 32-17 38-9-6-17-20-17-38 0-12 6-22 17-22z" fill="url(#a56)"/>
<path d="M42 34c5 16 5 32 0 48M58 34c-5 16-5 32 0 48" stroke="#6E5230" stroke-width="1.1" fill="none" opacity=".38"/>
<ellipse cx="43" cy="42" rx="6" ry="12" fill="#fff" opacity=".24"/></svg>`,

p57:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a57" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B08BC4"/><stop offset=".55" stop-color="#7D4F94"/><stop offset="1" stop-color="#4E2C61"/></linearGradient></defs>${SH}
<path d="M50 22c13 0 20 12 20 26 0 20-9 36-20 42-11-6-20-22-20-42 0-14 7-26 20-26z" fill="url(#a57)"/>
<path d="M42 32c5 16 5 32 0 50M58 32c-5 16-5 32 0 50" stroke="#4E2C61" stroke-width="1.1" fill="none" opacity=".35"/>
<ellipse cx="42" cy="40" rx="7" ry="12" fill="#fff" opacity=".22"/></svg>`,

p58:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 86V40" stroke="#3E7A24" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#4E9430">
<ellipse cx="42" cy="38" rx="9" ry="6" transform="rotate(-30 42 38)"/><ellipse cx="58" cy="38" rx="9" ry="6" transform="rotate(30 58 38)"/>
<ellipse cx="40" cy="50" rx="9" ry="6" transform="rotate(-30 40 50)"/><ellipse cx="60" cy="50" rx="9" ry="6" transform="rotate(30 60 50)"/>
<ellipse cx="42" cy="62" rx="9" ry="6" transform="rotate(-30 42 62)"/><ellipse cx="58" cy="62" rx="9" ry="6" transform="rotate(30 58 62)"/>
<ellipse cx="50" cy="30" rx="8" ry="5"/></g>
<ellipse cx="40" cy="48" rx="3" ry="2" fill="#fff" opacity=".3"/></svg>`,

p59:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44M50 60c-7-5-13-8-19-10M50 54c7-5 13-8 19-10M50 72c-6-4-11-6-16-7M50 66c6-4 11-6 16-7" stroke="#3E7A24" stroke-width="2" fill="none" stroke-linecap="round"/>
<g fill="#6FAF3E">
<ellipse cx="28" cy="49" rx="7" ry="4" transform="rotate(-18 28 49)"/><ellipse cx="72" cy="43" rx="7" ry="4" transform="rotate(18 72 43)"/>
<ellipse cx="32" cy="64" rx="7" ry="4" transform="rotate(-18 32 64)"/><ellipse cx="68" cy="58" rx="7" ry="4" transform="rotate(18 68 58)"/>
<ellipse cx="50" cy="42" rx="7" ry="10"/></g>
<ellipse cx="47" cy="38" rx="3" ry="5" fill="#fff" opacity=".3"/></svg>`,

p60:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V42" stroke="#3E7A24" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#8FC15A">
<ellipse cx="40" cy="42" rx="12" ry="7" transform="rotate(-16 40 42)"/><ellipse cx="60" cy="42" rx="12" ry="7" transform="rotate(16 60 42)"/>
<ellipse cx="35" cy="58" rx="11" ry="6" transform="rotate(-16 35 58)"/><ellipse cx="65" cy="58" rx="11" ry="6" transform="rotate(16 65 58)"/>
<ellipse cx="50" cy="32" rx="9" ry="6"/></g>
<ellipse cx="38" cy="38" rx="4" ry="3" fill="#fff" opacity=".3"/></svg>`,

p61:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V46" stroke="#3E7A24" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#79C24C">
<circle cx="40" cy="46" r="8"/><circle cx="60" cy="46" r="8"/><circle cx="35" cy="60" r="7"/><circle cx="65" cy="60" r="7"/><circle cx="50" cy="36" r="8"/></g>
<ellipse cx="47" cy="33" rx="3" ry="4" fill="#fff" opacity=".3"/></svg>`,

p62:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V40" stroke="#8E2A3C" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#A6455A">
<ellipse cx="41" cy="40" rx="10" ry="6" transform="rotate(-20 41 40)"/><ellipse cx="59" cy="40" rx="10" ry="6" transform="rotate(20 59 40)"/>
<ellipse cx="36" cy="55" rx="9" ry="6" transform="rotate(-20 36 55)"/><ellipse cx="64" cy="55" rx="9" ry="6" transform="rotate(20 64 55)"/>
<ellipse cx="50" cy="30" rx="8" ry="6"/></g>
<ellipse cx="46" cy="27" rx="3" ry="3" fill="#fff" opacity=".3"/></svg>`,

p63:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44" stroke="#3E7A24" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#6CA83A">
<ellipse cx="39" cy="44" rx="11" ry="7" transform="rotate(-22 39 44)"/><ellipse cx="61" cy="44" rx="11" ry="7" transform="rotate(22 61 44)"/>
<ellipse cx="50" cy="34" rx="9" ry="6"/></g>
<ellipse cx="45" cy="31" rx="3" ry="3" fill="#fff" opacity=".3"/></svg>`,

p64:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V46" stroke="#8E2A3C" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#C2536A">
<ellipse cx="40" cy="46" rx="10" ry="7" transform="rotate(-20 40 46)"/><ellipse cx="60" cy="46" rx="10" ry="7" transform="rotate(20 60 46)"/>
<ellipse cx="50" cy="36" rx="8" ry="6"/></g>
<ellipse cx="46" cy="33" rx="3" ry="3" fill="#fff" opacity=".3"/></svg>`,

p65:`<svg viewBox="0 0 100 100">${SH}
<path d="M42 86c-2-16-2-30 2-42M58 86c2-16 2-30-2-42M50 86V40" stroke="#3E7A24" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g fill="#5F8E2C">
<ellipse cx="42" cy="42" rx="8" ry="5" transform="rotate(-20 42 42)"/><ellipse cx="58" cy="42" rx="8" ry="5" transform="rotate(20 58 42)"/>
<ellipse cx="50" cy="34" rx="7" ry="5"/></g></svg>`,

p66:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88c-4-16-2-32 3-46M50 88c4-16 2-32-3-46" stroke="#3E6B1C" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g fill="#3E7A24">
<ellipse cx="43" cy="44" rx="9" ry="7" transform="rotate(-24 43 44)"/><ellipse cx="57" cy="34" rx="9" ry="7" transform="rotate(24 57 34)"/>
<ellipse cx="47" cy="60" rx="8" ry="6" transform="rotate(-24 47 60)"/><ellipse cx="53" cy="50" rx="8" ry="6" transform="rotate(24 53 50)"/></g>
<ellipse cx="40" cy="41" rx="3" ry="2" fill="#fff" opacity=".3"/></svg>`,

p67:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V36" stroke="#3E7A24" stroke-width="2" fill="none" stroke-linecap="round"/>
<g stroke="#5F8E2C" stroke-width="1.4" fill="none">
<path d="M50 44c-8-3-14-2-19 2M50 44c8-3 14-2 19 2M50 54c-7-3-12-2-16 2M50 54c7-3 12-2 16 2M50 64c-6-2-10-1-13 2M50 64c6-2 10-1 13 2M50 74c-5-2-8-1-10 2M50 74c5-2 8-1 10 2"/></g>
<circle cx="50" cy="34" r="4" fill="#6CA83A"/></svg>`,

p68:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44" stroke="#3E7A24" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#79C24C">
<ellipse cx="40" cy="44" rx="10" ry="8" transform="rotate(-18 40 44)"/><ellipse cx="60" cy="44" rx="10" ry="8" transform="rotate(18 60 44)"/>
<ellipse cx="50" cy="34" rx="8" ry="7"/></g>
<ellipse cx="46" cy="31" rx="3" ry="3" fill="#fff" opacity=".3"/></svg>`,

p69:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 30c14 8 20 22 20 36 0 12-8 20-20 20s-20-8-20-20c0-14 6-28 20-36z" fill="#5FA334"/>
<path d="M50 30v56M40 46c4 12 4 24 0 34M60 46c-4 12-4 24 0 34" stroke="#3E7A24" stroke-width="1.2" fill="none" opacity=".4"/>
<ellipse cx="40" cy="48" rx="6" ry="10" fill="#fff" opacity=".24"/></svg>`,

p70:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a70" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CC85A"/><stop offset=".55" stop-color="#5A9E30"/><stop offset="1" stop-color="#356418"/></linearGradient></defs>${SH}
<path d="M50 32c8 0 13 6 13 16 0 20-4 34-13 40-9-6-13-20-13-40 0-10 5-16 13-16z" fill="url(#a70)"/>
<path d="M42 38c3 16 3 28 0 42M58 38c-3 16-3 28 0 42" stroke="#356418" stroke-width="1" fill="none" opacity=".4"/>
<ellipse cx="44" cy="44" rx="4" ry="10" fill="#fff" opacity=".26"/></svg>`,

p71:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a71" cx="34%" cy="30%"><stop offset="0" stop-color="#C6E39A"/><stop offset=".55" stop-color="#8FC15A"/><stop offset="1" stop-color="#5A8E30"/></radialGradient></defs>${SH}
<path d="M50 30c13 0 22 12 20 26-6 4-9 12-9 20 0 6-5 10-11 10s-11-4-11-10c0-8-3-16-9-20-2-14 7-26 20-26z" fill="url(#a71)"/>
<ellipse cx="40" cy="42" rx="7" ry="10" fill="#fff" opacity=".26"/></svg>`,

p72:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a72" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B6DD7C"/><stop offset=".55" stop-color="#84B94A"/><stop offset="1" stop-color="#547A26"/></linearGradient></defs>${SH}
<rect x="26" y="34" width="48" height="44" rx="20" fill="url(#a72)"/>
<g stroke="#547A26" stroke-width="1" opacity=".4"><path d="M32 44h36M30 56h40M32 68h36"/></g>
<ellipse cx="40" cy="44" rx="6" ry="10" fill="#fff" opacity=".26"/></svg>`,

p73:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a73" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M20 60c8-16 20-28 34-32 12-3 24 2 26 12 2 10-6 18-18 22-16 5-32 4-42-2z" fill="url(#a73)"/>
<path d="M28 54c14-4 30-10 42-20" stroke="#3E7A20" stroke-width="1.5" fill="none" opacity=".4"/>
<ellipse cx="34" cy="50" rx="7" ry="4" fill="#fff" opacity=".26" transform="rotate(-16 34 50)"/></svg>`,

p74:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a74" cx="34%" cy="28%"><stop offset="0" stop-color="#D8E5A0"/><stop offset=".55" stop-color="#AAC868"/><stop offset="1" stop-color="#728A38"/></radialGradient></defs>${SH}
<path d="M50 20c17 0 28 15 28 32 0 19-13 32-28 32S22 71 22 52c0-17 11-32 28-32z" fill="url(#a74)"/>
<g stroke="#728A38" stroke-width="1" fill="none" opacity=".3"><path d="M32 40c10-6 26-6 36 0M28 52h44M32 64c10 6 26 6 36 0"/></g>
<ellipse cx="40" cy="42" rx="8" ry="12" fill="#fff" opacity=".2"/></svg>`,

p75:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a75" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7BAE4E"/><stop offset=".55" stop-color="#4E7A28"/><stop offset="1" stop-color="#2E4E16"/></linearGradient></defs>${SH}
<path d="M38 28c4-3 20-3 24 0 5 15 5 43 0 58-4 3-20 3-24 0-5-15-5-43 0-58z" fill="url(#a75)"/>
<g fill="#D8E8B0" opacity=".7"><circle cx="42" cy="38" r="1.4"/><circle cx="52" cy="34" r="1.4"/><circle cx="46" cy="52" r="1.4"/><circle cx="56" cy="48" r="1.4"/><circle cx="42" cy="64" r="1.4"/><circle cx="54" cy="68" r="1.4"/></g>
<ellipse cx="43" cy="42" rx="4" ry="14" fill="#fff" opacity=".22"/></svg>`,

p76:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a76" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".55" stop-color="#F0C449"/><stop offset="1" stop-color="#C99A18"/></linearGradient></defs>${SH}
<path d="M45 26c3-2 7-2 10 0 3 16 3 40 0 56-3 2-7 2-10 0-3-16-3-40 0-56z" fill="url(#a76)"/>
<g stroke="#C99A18" stroke-width=".8" opacity=".4"><path d="M43 34h14M42 42h16M42 50h16M42 58h16M42 66h16M43 74h14"/></g>
<path d="M42 26c-6-4-12-4-16 0 3 5 10 7 16 0zM58 26c6-4 12-4 16 0-3 5-10 7-16 0z" fill="#5F8E2C"/></svg>`,

p77:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a77" cx="34%" cy="28%"><stop offset="0" stop-color="#FDF4E6"/><stop offset=".55" stop-color="#EBD8BE"/><stop offset="1" stop-color="#C7A87E"/></radialGradient></defs>${SH}
<rect x="45" y="52" width="10" height="30" rx="4" fill="#EBD8BE"/>
<path d="M28 52c0-14 10-24 22-24s22 10 22 24c0 6-4 8-22 8s-22-2-22-8z" fill="url(#a77)"/>
<ellipse cx="40" cy="42" rx="6" ry="9" fill="#fff" opacity=".3"/></svg>`,

p78:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a78" cx="34%" cy="28%"><stop offset="0" stop-color="#7BAE4E"/><stop offset=".55" stop-color="#4E7A28"/><stop offset="1" stop-color="#2E4E16"/></radialGradient></defs>${SH}
<rect x="46" y="66" width="8" height="16" rx="3" fill="#4E7A28"/>
<circle cx="42" cy="42" r="15" fill="url(#a78)"/><circle cx="58" cy="42" r="15" fill="url(#a78)"/>
<circle cx="50" cy="30" r="15" fill="url(#a78)"/><circle cx="50" cy="52" r="16" fill="url(#a78)"/>
<g fill="#2E4E16" opacity=".4"><circle cx="42" cy="40" r="1.4"/><circle cx="58" cy="40" r="1.4"/><circle cx="50" cy="28" r="1.4"/><circle cx="48" cy="54" r="1.4"/><circle cx="56" cy="58" r="1.4"/></g>
<ellipse cx="42" cy="34" rx="5" ry="6" fill="#fff" opacity=".22"/></svg>`,

p79:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a79" cx="34%" cy="30%"><stop offset="0" stop-color="#D9A0C4"/><stop offset=".55" stop-color="#A64E82"/><stop offset="1" stop-color="#6E2C52"/></radialGradient></defs>${SH}
<path d="M50 22c17 0 29 13 29 29S67 80 50 80 21 67 21 51s12-29 29-29z" fill="url(#a79)"/>
<path d="M50 26c14 0 24 11 24 25S64 76 50 76 26 65 26 51 36 26 50 26z" fill="#C270A0" opacity=".7"/>
<path d="M50 30c11 0 19 9 19 21S61 72 50 72s-19-9-19-21 8-21 19-21z" fill="#DA96BC" opacity=".7"/>
<ellipse cx="39" cy="40" rx="8" ry="13" fill="#fff" opacity=".24" transform="rotate(-20 39 40)"/></svg>`,

p80:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a80" cx="34%" cy="28%"><stop offset="0" stop-color="#F5877E"/><stop offset=".55" stop-color="#DA3D30"/><stop offset="1" stop-color="#961F1A"/></radialGradient></defs>${SH}
<path d="M50 26c15 0 26 12 26 27S65 82 50 82c-6 0-11-3-15-7-3 4-9 5-12 2-3-3-2-8 2-11-3-4-4-9-4-15 0-15 11-27 26-27z" fill="url(#a80)"/>
<path d="M42 22c-3-5-9-8-15-7 1 6 8 10 15 7zM58 22c3-5 9-8 15-7-1 6-8 10-15 7z" fill="#5F8E2C"/>
<ellipse cx="40" cy="40" rx="7" ry="11" fill="#fff" opacity=".24" transform="rotate(-20 40 40)"/></svg>`,

p81:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a81" cx="34%" cy="28%"><stop offset="0" stop-color="#FFE68A"/><stop offset=".55" stop-color="#F0BF2E"/><stop offset="1" stop-color="#A87A0F"/></radialGradient></defs>${SH}
<path d="M50 26c15 0 26 12 26 27S65 82 50 82c-6 0-11-3-15-7-3 4-9 5-12 2-3-3-2-8 2-11-3-4-4-9-4-15 0-15 11-27 26-27z" fill="url(#a81)"/>
<path d="M42 22c-3-5-9-8-15-7 1 6 8 10 15 7zM58 22c3-5 9-8 15-7-1 6-8 10-15 7z" fill="#5F8E2C"/>
<ellipse cx="40" cy="40" rx="7" ry="11" fill="#fff" opacity=".28" transform="rotate(-20 40 40)"/></svg>`,

p82:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V38M38 88c-2-16 0-32 6-44M62 88c2-16 0-32-6-44" stroke="#9FCF62" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M50 38c-3-6-2-11 2-15 2 4 1 9-2 15zM38 44c-6-3-9-8-8-13 5 1 9 6 8 13zM62 44c6-3 9-8 8-13-5 1-9 6-8 13z" fill="#5F8E2C"/></svg>`,

p83:`<svg viewBox="0 0 100 100">${SH}
<path d="M42 88V44M58 88V38" stroke="#EAE3D2" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M42 88V44M58 88V38" stroke="#C9C3AA" stroke-width="2" fill="none" opacity=".5"/>
<path d="M42 44c0-6 2-10 6-12M58 38c0-6 2-10 6-12" stroke="#5F8E2C" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,

p84:`<svg viewBox="0 0 100 100">${SH}
<path d="M30 30c4 20 8 40 4 56-1 4-6 4-7 0-6-18-4-38 3-56z" fill="#7BAE4E"/>
<path d="M50 26c4 22 9 44 4 62-1 4-6 4-7 0-7-20-4-42 3-62z" fill="#6CA83A"/>
<path d="M70 30c4 20 8 40 4 56-1 4-6 4-7 0-6-18-4-38 3-56z" fill="#5F8E2C"/></svg>`,

p85:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a85" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M22 44c8-8 18-10 26-4 8-8 20-8 28 0 8 8 8 20 0 28-10 10-24 12-34 2-10 10-24 8-32-2-6-8-4-18 12-24z" fill="url(#a85)"/>
<ellipse cx="34" cy="48" rx="6" ry="9" fill="#fff" opacity=".26" transform="rotate(-24 34 48)"/></svg>`,

p86:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a86" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9D46B"/><stop offset=".55" stop-color="#77AC3E"/><stop offset="1" stop-color="#4A7A22"/></linearGradient></defs>${SH}
<path d="M24 40c30-6 46 6 52 20 4 10-2 20-14 20-20 0-40-16-44-30-1-4 1-8 6-10z" fill="url(#a86)"/>
<path d="M28 44c14 0 30 6 40 18" stroke="#4A7A22" stroke-width="1.3" fill="none" opacity=".4"/>
<ellipse cx="34" cy="46" rx="6" ry="4" fill="#fff" opacity=".26" transform="rotate(-16 34 46)"/></svg>`,

p87:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a87" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M20 46c4-6 10-8 14-4 20 20 40 20 50 4 4-6 10-4 10 4 0 16-24 32-42 30-16-2-34-18-32-34z" fill="url(#a87)"/>
<circle cx="26" cy="44" r="6" fill="#4A7A22"/>
<ellipse cx="36" cy="52" rx="7" ry="4" fill="#fff" opacity=".26" transform="rotate(-16 36 52)"/></svg>`,

p88:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a88" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#79C24C"/><stop offset=".55" stop-color="#4E9430"/><stop offset="1" stop-color="#2E5E1A"/></linearGradient></defs>${SH}
<path d="M26 42c8-10 20-12 30-6 10-6 22-2 26 8 4 10-2 22-14 26-16 6-32 0-40-8-8-8-8-14-2-20z" fill="url(#a88)"/>
<ellipse cx="36" cy="46" rx="7" ry="9" fill="#fff" opacity=".24" transform="rotate(-22 36 46)"/></svg>`,

p89:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 86V40" stroke="#5F8E2C" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#7BAE4E">
<ellipse cx="42" cy="42" rx="16" ry="4" transform="rotate(-8 42 42)"/><ellipse cx="58" cy="56" rx="16" ry="4" transform="rotate(8 58 56)"/>
<ellipse cx="40" cy="66" rx="14" ry="3.6" transform="rotate(-6 40 66)"/></g></svg>`,

p90:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 86V44" stroke="#5F8E2C" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g fill="#8FC15A"><circle cx="38" cy="44" r="6"/><circle cx="62" cy="50" r="6"/><circle cx="44" cy="62" r="6"/><circle cx="58" cy="70" r="5"/></g>
<g fill="#3E6B1C" opacity=".3"><circle cx="38" cy="44" r="1.4"/><circle cx="62" cy="50" r="1.4"/></g></svg>`,

p91:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a91" cx="34%" cy="28%"><stop offset="0" stop-color="#D8C29C"/><stop offset=".55" stop-color="#AD8A56"/><stop offset="1" stop-color="#6E5230"/></radialGradient></defs>${SH}
<path d="M50 22c18 0 30 14 30 30S68 84 50 84 20 68 20 52s12-30 30-30z" fill="url(#a91)"/>
<g stroke="#6E5230" stroke-width="1" opacity=".35"><path d="M30 40c14-8 26-8 40 0M26 52h48M30 64c14 8 26 8 40 0"/></g>
<ellipse cx="40" cy="42" rx="8" ry="13" fill="#fff" opacity=".22"/></svg>`,

p92:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a92" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M28 40c26-6 42 4 48 18 4 10-3 20-16 20-18 0-36-12-38-26-1-6 1-10 6-12z" fill="url(#a92)"/>
<g fill="#8A2530" opacity=".85"><ellipse cx="42" cy="52" rx="4" ry="3"/><ellipse cx="54" cy="58" rx="4" ry="3"/><ellipse cx="48" cy="64" rx="4" ry="3"/></g>
<ellipse cx="34" cy="46" rx="6" ry="4" fill="#fff" opacity=".26" transform="rotate(-16 34 46)"/></svg>`,

p93:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44" stroke="#3E7A24" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#6CA83A"><ellipse cx="40" cy="44" rx="8" ry="6" transform="rotate(-20 40 44)"/><ellipse cx="60" cy="44" rx="8" ry="6" transform="rotate(20 60 44)"/>
<ellipse cx="36" cy="58" rx="7" ry="5" transform="rotate(-20 36 58)"/><ellipse cx="64" cy="58" rx="7" ry="5" transform="rotate(20 64 58)"/>
<ellipse cx="50" cy="34" rx="7" ry="5"/></g></svg>`,

p94:`<svg viewBox="0 0 100 100">${SH}
<path d="M46 86c-4-20-2-40 4-56M54 86c4-20 2-40-4-56" stroke="#8E2A3C" stroke-width="5" fill="none" stroke-linecap="round"/>
<g fill="#A6455A" opacity=".6"><circle cx="44" cy="40" r="2"/><circle cx="56" cy="46" r="2"/><circle cx="42" cy="58" r="2"/><circle cx="58" cy="64" r="2"/></g></svg>`,

p95:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a95" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M50 20c10 0 16 8 16 20 0 26-6 46-16 54-10-8-16-28-16-54 0-12 6-20 16-20z" fill="url(#a95)"/>
<path d="M42 30c-4 22-4 42 0 60M58 30c4 22 4 42 0 60" stroke="#EAF4CE" stroke-width="1.3" fill="none" opacity=".5"/>
<path d="M50 20c-1-4-1-7 0-9 1 2 1 5 0 9z" fill="#4A7522"/>
<ellipse cx="42" cy="42" rx="5" ry="14" fill="#fff" opacity=".24"/></svg>`,

p96:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a96" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FCF62"/><stop offset=".55" stop-color="#6CA83A"/><stop offset="1" stop-color="#3E7A20"/></linearGradient></defs>${SH}
<path d="M40 28c4-3 16-3 20 0 6 18 6 40 0 60-4 3-16 3-20 0-6-20-6-42 0-60z" fill="url(#a96)"/>
<path d="M40 36h20M39 46h22M39 56h22M40 66h20" stroke="#3E7A20" stroke-width="1" opacity=".4"/>
<ellipse cx="44" cy="42" rx="5" ry="14" fill="#fff" opacity=".24"/></svg>`,

p97:`<svg viewBox="0 0 100 100">${SH}
<path d="M30 28c22 4 44 20 46 40 1 10-6 16-14 12-18-8-32-30-34-48 0-3 1-4 2-4z" fill="#7BAE4E"/>
<path d="M32 32c16 6 32 22 38 38" stroke="#4A7522" stroke-width="1.5" fill="none" opacity=".4"/>
<path d="M30 28c-4-5-10-7-15-6 2 6 9 9 15 6z" fill="#5F8E2C"/></svg>`,

p98:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a98" cx="34%" cy="28%"><stop offset="0" stop-color="#D8E5A0"/><stop offset=".55" stop-color="#9DBB5C"/><stop offset="1" stop-color="#5E7A2E"/></radialGradient></defs>${SH}
<circle cx="50" cy="54" r="27" fill="url(#a98)"/>
<g stroke="#4E6524" stroke-width="1" fill="none" opacity=".4"><path d="M24 46c12-6 40-6 52 0M24 62c12 6 40 6 52 0"/></g>
<ellipse cx="40" cy="42" rx="7" ry="11" fill="#fff" opacity=".22"/></svg>`,

p99:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a99" x1="0" y1="0" x2="1" y2=".8"><stop offset="0" stop-color="#F0D080"/><stop offset=".55" stop-color="#D8A83E"/><stop offset="1" stop-color="#9C7014"/></linearGradient></defs>${SH}
<path d="M30 60c-4-10 2-20 12-22 4-8 14-10 20-4 8-2 16 4 16 14 0 8-6 14-14 14-2 6-10 10-16 6-8 4-16-1-18-8z" fill="url(#a99)"/>
<ellipse cx="42" cy="48" rx="6" ry="9" fill="#fff" opacity=".26" transform="rotate(-20 42 48)"/></svg>`,

p100:`<svg viewBox="0 0 100 100"><defs><linearGradient id="a100" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A5636"/><stop offset=".55" stop-color="#4A3018"/><stop offset="1" stop-color="#2A1A0C"/></linearGradient></defs>${SH}
<path d="M50 28l24 40-24 20-24-20z" fill="url(#a100)"/>
<path d="M50 28l24 40-24 20-24-20z" stroke="#2A1A0C" stroke-width="1" fill="none" opacity=".3"/>
<ellipse cx="42" cy="48" rx="6" ry="10" fill="#fff" opacity=".18" transform="rotate(-20 42 48)"/></svg>`,

p101:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44" stroke="#5F8E2C" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#8FC15A"><ellipse cx="38" cy="44" rx="9" ry="6" transform="rotate(-20 38 44)"/><ellipse cx="62" cy="44" rx="9" ry="6" transform="rotate(20 62 44)"/>
<ellipse cx="50" cy="34" rx="7" ry="5"/></g>
<path d="M42 88c0-6 4-10 8-12M58 88c0-6-4-10-8-12" stroke="#EAE3D2" stroke-width="4" fill="none"/></svg>`,

p102:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44" stroke="#3E7A20" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#F2A030">
<ellipse cx="40" cy="44" rx="9" ry="6" transform="rotate(-20 40 44)"/><ellipse cx="60" cy="44" rx="9" ry="6" transform="rotate(20 60 44)"/>
<ellipse cx="50" cy="34" rx="7" ry="5"/></g></svg>`,

p103:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a103" cx="34%" cy="28%"><stop offset="0" stop-color="#6E4E6E"/><stop offset=".55" stop-color="#4A2E4A"/><stop offset="1" stop-color="#2A1A2A"/></radialGradient></defs>${SH}
<path d="M50 26c8 0 12 8 12 18 0 8-3 12-3 22 0 10 6 12 6 20 0 6-6 10-15 10s-15-4-15-10c0-8 6-10 6-20 0-10-3-14-3-22 0-10 4-18 12-18z" fill="url(#a103)"/>
<path d="M42 20c-4-5-10-7-15-6 2 6 9 9 15 6zM58 20c4-5 10-7 15-6-2 6-9 9-15 6z" fill="#5F8E2C"/>
<ellipse cx="43" cy="42" rx="5" ry="10" fill="#fff" opacity=".2"/></svg>`,

p104:`<svg viewBox="0 0 100 100">${SH}
<path d="M22 50c14-6 18-16 14-26 8 2 14 10 12 20 10-4 20 0 24 10 3 8-2 16-12 18-4 8-14 12-24 8-10-4-16-14-14-22-4-2-6-5-6-8z" fill="#7BAE4E"/>
<g fill="#E8D060"><circle cx="36" cy="50" r="6"/><circle cx="50" cy="46" r="6"/><circle cx="60" cy="58" r="6"/><circle cx="44" cy="62" r="6"/></g>
<ellipse cx="34" cy="48" rx="3" ry="3" fill="#fff" opacity=".3"/></svg>`,

p105:`<svg viewBox="0 0 100 100"><defs><radialGradient id="a105" cx="34%" cy="28%"><stop offset="0" stop-color="#E8D080"/><stop offset=".55" stop-color="#C9A030"/><stop offset="1" stop-color="#8A6812"/></radialGradient></defs>${SH}
<path d="M50 30c14 6 20 20 20 32 0 12-9 22-20 22s-20-10-20-22c0-12 6-26 20-32z" fill="url(#a105)"/>
<path d="M42 24c-4-5-10-7-15-6 2 6 9 9 15 6zM58 24c4-5 10-7 15-6-2 6-9 9-15 6z" fill="#5F8E2C"/>
<ellipse cx="42" cy="46" rx="6" ry="10" fill="#fff" opacity=".24"/></svg>`,

p106:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V44" stroke="#5F8E2C" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g fill="#8E2A3C"><circle cx="38" cy="44" r="7"/><circle cx="62" cy="50" r="7"/><circle cx="44" cy="62" r="7"/><circle cx="58" cy="70" r="6"/></g>
<g fill="#fff" opacity=".26"><circle cx="36" cy="41" r="2"/><circle cx="60" cy="47" r="2"/></g></svg>`,

p107:`<svg viewBox="0 0 100 100">${SH}
<path d="M50 88V52" stroke="#3E7A20" stroke-width="3" fill="none" stroke-linecap="round"/>
<g fill="#F2A030">
<path d="M50 52c-14 0-22-10-20-20 8 0 16 6 20 14 4-8 12-14 20-14 2 10-6 20-20 20z"/>
<path d="M50 52c-10 4-16 12-14 20 8-2 14-8 16-16 2 8 8 14 16 16 2-8-4-16-14-20z"/></g>
<circle cx="50" cy="48" r="7" fill="#D8850E"/>
<ellipse cx="44" cy="44" rx="3" ry="4" fill="#fff" opacity=".3"/></svg>`,
};

/** vendor-typed name → drawing key */
export const ART_ALIAS: Record<string, string> = {
  'aloo':'p1','potato':'p1','pyaaz':'p2','onion':'p2','lehsun':'p3','garlic':'p3',
  'tamatar':'p6','tomato':'p6','bhindi':'p7','okra':'p7','baingan':'p8','brinjal':'p8',
  'lauki':'p9','ghiya':'p9','gobhi':'p10','cauliflower':'p10','palak':'p11','spinach':'p11',
  'dhaniya':'p12','coriander':'p12','hari mirch':'p13','mirch':'p13','gajar':'p14','carrot':'p14',
  'kheera':'p15','cucumber':'p15','matar':'p16','peas':'p16','shimla mirch':'p17','capsicum':'p17',
  'karela':'p18','torai':'p19','kela':'p20','banana':'p20','seb':'p21','apple':'p21',
  'santra':'p22','orange':'p22','papita':'p23','angoor':'p24','grapes':'p24',
  'tarbooj':'p25','amrood':'p26','guava':'p26','anaar':'p27','pomegranate':'p27',
  'kaddu':'p28','pumpkin':'p28','shakarkandi':'p29','sweet potato':'p29',
  'arbi':'p30','colocasia':'p30','suran':'p31','yam':'p31','parwal':'p32','tinda':'p33',
  'chukandar':'p34','beetroot':'p34','muli':'p35','radish':'p35',
  'patta gobhi':'p36','cabbage':'p36','bandh gobhi':'p36','hara pyaaz':'p37','spring onion':'p37',
  'adrak':'p38','ginger':'p38','sem phali':'p39','flat beans':'p39',
  'bhutta':'p40','corn':'p40','kathal':'p41','jackfruit':'p41','pudina':'p42','mint':'p42',
  'chikoo':'p43','sapota':'p43','litchi':'p44','lychee':'p44','ananas':'p45','pineapple':'p45',
  'nashpati':'p46','pear':'p46','kharbuja':'p47','muskmelon':'p47',
  'nariyal':'p48','coconut':'p48','khajoor':'p49','dates':'p49',
  'jamun':'p50','ber':'p51','strawberry':'p52',
  'kamal kakdi':'p54','lotus stem':'p54','shalgam':'p55','turnip':'p55',
  'kachalu':'p56','taro':'p56','ratalu':'p57','purple yam':'p57',
  'kadi patta':'p58','curry leaves':'p58','methi saag':'p59','fenugreek leaves':'p59',
  'sarson saag':'p60','mustard greens':'p60','bathua':'p61','chaulai saag':'p62','amaranth leaves':'p62',
  'chawli saag':'p63','cowpea leaves':'p63','gongura':'p64','sorrel leaves':'p64',
  'kalmi saag':'p65','water spinach':'p65','poi saag':'p66','malabar spinach':'p66',
  'suva saag':'p67','dill':'p67','ajwain patta':'p68','carom leaves':'p68',
  'karam saag':'p69','colocasia leaves':'p69','kundru':'p70','ivy gourd':'p70',
  'chappan kaddu':'p71','chayote':'p71','kakdi':'p72','salad cucumber':'p72',
  'chichinda':'p73','snake gourd':'p73','petha kaddu':'p74','ash gourd':'p74',
  'zucchini':'p75','baby corn':'p76','khumb':'p77','mushroom':'p77',
  'hari gobhi':'p78','broccoli':'p78','patta gobhi lal':'p79','red cabbage':'p79',
  'shimla mirch lal':'p80','red capsicum':'p80','shimla mirch peeli':'p81','yellow capsicum':'p81',
  'ajmoda':'p82','celery':'p82','gandana':'p83','leek':'p83',
  'sahjan':'p84','drumstick':'p84','moringa':'p84','sohanjna':'p84',
  'gawar phali':'p85','gawar':'p85','cluster beans':'p85','frans beans':'p86','french beans':'p86',
  'lobia':'p87','yardlong beans':'p87','val papdi':'p88','flat beans papdi':'p88',
  'sangri':'p89','desert beans':'p89','kair':'p90','caper':'p90',
  'jimikand':'p91','elephant foot yam':'p91','rajma phali':'p92','fresh kidney bean':'p92',
  'chana saag':'p93','chickpea greens':'p93','amaranth dandal':'p94','amaranth stem':'p94',
  'karela bada':'p95','ghiya tori':'p96','sponge gourd':'p96',
  'bhavnagri mirch':'p97','kachri':'p98','amba haldi':'p99','mango ginger':'p99',
  'singhada':'p100','water chestnut':'p100','mooli patta':'p101','radish greens':'p101',
  'kaddu patta':'p102','pumpkin leaves':'p102','kali gajar':'p103','black carrot':'p103',
  'hara chana':'p104','green chickpea':'p104','lasoda':'p105','gunda':'p105',
  'karonda':'p106','kaddu phool':'p107','pumpkin flower':'p107'
};

/** fallback emoji for items without a drawing */
export const EMOJI_ALIAS: Record<string, string> = {
  'kaddu':'🎃','pumpkin':'🎃','shakarkandi':'🍠','sweet potato':'🍠',
  'arbi':'🥔','colocasia':'🥔','suran':'🥔','yam':'🥔','parwal':'🥒','tinda':'🥒',
  'chukandar':'🍠','beetroot':'🍠','muli':'🥕','radish':'🥕',
  'patta gobhi':'🥬','cabbage':'🥬','hara pyaaz':'🧅','spring onion':'🧅',
  'adrak':'🫚','ginger':'🫚','sem phali':'🫛','flat beans':'🫛',
  'bhutta':'🌽','corn':'🌽','kathal':'🥭','jackfruit':'🥭','pudina':'🌿','mint':'🌿',
  'chikoo':'🟤','sapota':'🟤','litchi':'🍒','lychee':'🍒','ananas':'🍍','pineapple':'🍍',
  'nashpati':'🍐','pear':'🍐','kharbuja':'🍈','muskmelon':'🍈',
  'nariyal':'🥥','coconut':'🥥','khajoor':'🌰','dates':'🌰',
  'jamun':'🫐','ber':'🍒','strawberry':'🍓'
};
