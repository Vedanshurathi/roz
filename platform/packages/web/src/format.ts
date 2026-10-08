import { istDate, rupees, type Lang, type TimeSlot } from '@rozbazaar/shared';

export { rupees, istDate };

const SLOT_TEXT: Record<TimeSlot, { en: string; hi: string; icon: string }> = {
  morning: { en: 'Morning 7–11', hi: 'सुबह 7–11', icon: '🌅' },
  afternoon: { en: 'Afternoon 12–4', hi: 'दोपहर 12–4', icon: '☀️' },
  evening: { en: 'Evening 5–8', hi: 'शाम 5–8', icon: '🌇' },
};

export function slotLabel(slot: TimeSlot, lang: Lang): string {
  return lang === 'hi' ? SLOT_TEXT[slot].hi : SLOT_TEXT[slot].en;
}
export function slotIcon(slot: TimeSlot): string {
  return SLOT_TEXT[slot].icon;
}

/** "Today" / "Tomorrow" / "Fri, 3 Oct" (or Hindi) for an IST date string. */
export function dayLabel(iso: string, lang: Lang): string {
  if (iso === istDate(0)) return lang === 'hi' ? 'आज' : 'Today';
  if (iso === istDate(1)) return lang === 'hi' ? 'कल' : 'Tomorrow';
  if (iso === istDate(-1)) return lang === 'hi' ? 'कल (बीता)' : 'Yesterday';
  const d = new Date(`${iso}T12:00:00+05:30`);
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export function timeAgo(iso: string, lang: Lang): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  const hi = lang === 'hi';
  if (s < 60) return hi ? 'अभी' : 'just now';
  if (s < 3600) return hi ? `${Math.floor(s / 60)} मिनट पहले` : `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return hi ? `${Math.floor(s / 3600)} घंटे पहले` : `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(hi ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

/** Quantities like 2.5 without float noise. */
export function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
