/**
 * Vendors type on Latin keyboards, so "aloo" has to find आलू. Rough Devanagari → Latin, then both
 * sides normalised so vowel length stops mattering (aloo / aalu / alu all match).
 */
const DEVA: Record<string, string> = {
  अ: 'a',
  आ: 'aa',
  इ: 'i',
  ई: 'ee',
  उ: 'u',
  ऊ: 'oo',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
  ऋ: 'ri',
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'n',
  च: 'ch',
  छ: 'chh',
  ज: 'j',
  झ: 'jh',
  ञ: 'n',
  ट: 't',
  ठ: 'th',
  ड: 'd',
  ढ: 'dh',
  ण: 'n',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  व: 'v',
  श: 'sh',
  ष: 'sh',
  स: 's',
  ह: 'h',
  ळ: 'l',
  क़: 'q',
  ख़: 'kh',
  ग़: 'g',
  ज़: 'z',
  ड़: 'r',
  ढ़: 'rh',
  फ़: 'f',
  'ा': 'aa',
  'ि': 'i',
  'ी': 'ee',
  'ु': 'u',
  'ू': 'oo',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  'ं': 'n',
  'ँ': 'n',
  'ः': 'h',
  '़': '',
  '्': '',
};
const MATRA = 'ािीुूेैोौंँः़्';
const LABIAL = 'पफबभम';

export function translit(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    let c = str[i]!;
    let nx = str[i + 1];
    // ज + ़ arrives as two code points — fold it into ज़
    if (nx === '़' && DEVA[c + nx] !== undefined) {
      c += nx;
      i++;
      nx = str[i + 1];
    }
    let m = DEVA[c];
    if (m === undefined) {
      out += c;
      continue;
    }
    // anusvara takes the colour of what follows: नींबू is nimbu, not ninbu
    if (c === 'ं' || c === 'ँ') m = nx && LABIAL.includes(nx) ? 'm' : 'n';
    out += m;
    const isCons = c.length === 1 && c >= 'क' && c <= 'ह' && !MATRA.includes(c);
    if (isCons && (nx === undefined || !MATRA.includes(nx))) out += 'a';
  }
  return out;
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/aa/g, 'a')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/z/g, 'j')
    .replace(/w/g, 'v')
    .replace(/ck/g, 'k')
    .replace(/[^a-z0-9]/g, '');
}

/** 3 = starts with, 2 = word starts with, 1 = contains, 0 = no match. */
export function matchScore(names: Array<string | null | undefined>, query: string): number {
  const raw = query.trim();
  if (!raw) return 0;
  const nq = norm(raw);
  const pairs: Array<[string, string]> = [];
  for (const n of names) {
    if (!n) continue;
    pairs.push([n.toLowerCase(), raw.toLowerCase()]);
    if (nq) pairs.push([norm(n), nq], [norm(translit(n)), nq]);
  }
  let best = 0;
  for (const [hay, needle] of pairs) {
    if (!hay || !needle) continue;
    const idx = hay.indexOf(needle);
    if (idx === 0) best = Math.max(best, 3);
    else if (idx > 0 && /[\s-]/.test(hay[idx - 1]!)) best = Math.max(best, 2);
    else if (idx > 0) best = Math.max(best, 1);
  }
  return best;
}
