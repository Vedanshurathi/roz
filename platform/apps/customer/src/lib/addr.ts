import type { Address } from '@rozbazaar/shared';

/** "House 12, Main road, Khandewla · near the temple" */
export function lineOf(a: Address | null | undefined): string {
  if (!a) return '';
  return [a.house, a.street, a.area].filter(Boolean).join(', ') + (a.landmark ? ' · ' + a.landmark : '');
}

/** The address this order goes to: the one picked at checkout, else the default, else the first. */
export function orderAddress(list: Address[] | undefined, pickedId: string | null): Address | null {
  const l = list ?? [];
  return l.find((a) => a.id === pickedId) ?? l.find((a) => a.isDefault) ?? l[0] ?? null;
}
