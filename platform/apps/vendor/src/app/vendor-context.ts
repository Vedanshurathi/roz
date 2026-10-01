import { createContext, useContext } from 'react';
import type { VendorProfile } from '@rozbazaar/shared';

/**
 * The logged-in vendor, provided by the RequireVendor route guard. Pages read it from here rather
 * than from the session query, so they never render without one (e.g. mid-logout, when the query
 * cache is being cleared).
 */
export const VendorContext = createContext<VendorProfile | null>(null);

export function useVendor(): VendorProfile {
  const v = useContext(VendorContext);
  if (!v) throw new Error('useVendor() is only available inside <RequireVendor>');
  return v;
}
