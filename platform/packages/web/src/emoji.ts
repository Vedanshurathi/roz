/** Fallback picture when an item has no photo (or the photo fails to load). */
const BY_NAME: Array<[RegExp, string]> = [
  [/tamatar|tomato|टमाटर/i, '🍅'],
  [/aloo|potato|आलू/i, '🥔'],
  [/pyaa?z|onion|प्याज/i, '🧅'],
  [/bhindi|okra|भिंडी/i, '🫛'],
  [/dhaniya|coriander|धनिया|pudina|mint|palak|spinach|methi|saag/i, '🌿'],
  [/mirch|chil+i|मिर्च/i, '🌶️'],
  [/shimla|capsicum|moti mirch/i, '🫑'],
  [/gaajar|gajar|carrot|गाजर/i, '🥕'],
  [/kheera|cucumber|खीरा/i, '🥒'],
  [/baingan|brinjal|बैंगन/i, '🍆'],
  [/lahsun|garlic|लहसुन/i, '🧄'],
  [/adrak|ginger|अदरक/i, '🫚'],
  [/gobhi|cauliflower|cabbage|गोभी/i, '🥦'],
  [/matar|peas|मटर/i, '🫛'],
  [/makka|corn|भुट्टा/i, '🌽'],
  [/nimbu|lemon|नींबू/i, '🍋'],
  [/seb|apple|सेब/i, '🍎'],
  [/kela|banana|केला/i, '🍌'],
  [/aam|mango|आम/i, '🥭'],
  [/angoor|grape|अंगूर/i, '🍇'],
  [/santra|orange|संतरा|mausami/i, '🍊'],
  [/anaar|pomegranate|अनार/i, '🍎'],
  [/papita|papaya|पपीता/i, '🍈'],
  [/tarbooz|watermelon|तरबूज/i, '🍉'],
  [/amrood|guava|अमरूद/i, '🍐'],
];

export function itemEmoji(name: string, category?: string | null): string {
  for (const [re, e] of BY_NAME) if (re.test(name)) return e;
  if (category === 'fruit') return '🍎';
  if (category === 'onion_potato') return '🧅';
  return '🥬';
}
