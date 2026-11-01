import type { Booking, BookingStatus } from '@rozbazaar/shared';

/**
 * Where an order is from the vendor's side. bill_approved counts as "bill": the customer's
 * nod is optional — the vendor can take payment straight off bill_final. "paid" is separate
 * because the delivery code still has to be confirmed.
 */
export type Phase =
  'new' | 'way' | 'reached' | 'bill' | 'paid' | 'disputed' | 'done' | 'missed' | 'review' | 'cancelled';

const PHASE: Record<BookingStatus, Phase> = {
  placed: 'new',
  on_the_way: 'way',
  reached: 'reached',
  bill_final: 'bill',
  bill_approved: 'bill',
  paid: 'paid',
  delivered: 'done',
  completed: 'done',
  disputed: 'disputed',
  missed: 'missed',
  pending_review: 'review',
  cancelled: 'cancelled',
};

export const phaseOf = (s: BookingStatus): Phase => PHASE[s];

/** Orders the vendor still has to act on — the only ones shown as cards on Home. */
export const isActive = (b: Pick<Booking, 'status'>) =>
  ['new', 'way', 'reached', 'bill', 'paid', 'disputed'].includes(phaseOf(b.status));

export function statusPill(
  s: BookingStatus,
  t: (en: string, hi: string) => string,
): { text: string; tone: string } {
  switch (s) {
    case 'placed':
      return { text: t('New', 'नया'), tone: 'b' };
    case 'on_the_way':
      return { text: t('On the way', 'रास्ते में'), tone: 'o' };
    case 'reached':
      return { text: t('At the door', 'पहुँच गए'), tone: 'o' };
    case 'bill_final':
      return { text: t('Bill sent', 'बिल भेजा'), tone: 'o' };
    case 'bill_approved':
      return { text: t('Bill approved', 'बिल मंज़ूर'), tone: 'g' };
    case 'paid':
      return { text: t('Paid — code left', 'पैसे मिले — कोड बाकी'), tone: 'g' };
    case 'disputed':
      return { text: t('Customer objected', 'ग्राहक की आपत्ति'), tone: 'r' };
    case 'delivered':
    case 'completed':
      return { text: t('Delivered', 'डिलीवर'), tone: 'g' };
    case 'missed':
      return { text: t('Missed', 'छूट गया'), tone: 'r' };
    case 'cancelled':
      return { text: t('Cancelled', 'रद्द'), tone: 'r' };
    default:
      return { text: t('Under review', 'जाँच में'), tone: '' };
  }
}

/** The bill total if there is one, else the estimate. */
export const orderTotal = (b: Pick<Booking, 'finalTotal' | 'estTotal'>) => b.finalTotal ?? b.estTotal;

/** Google Maps directions: the saved pin if there is one, else the address text. */
export function navigateUrl(b: Pick<Booking, 'mapsUrl' | 'lat' | 'lng' | 'addressLine' | 'area'>): string {
  if (b.mapsUrl) return b.mapsUrl;
  const dest = b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : `${b.addressLine}, ${b.area}, Haryana`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
