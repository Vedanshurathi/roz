import { useQuery } from '@tanstack/react-query';
import type {
  Area,
  Booking,
  CatalogItem,
  SessionInfo,
  TimeSlot,
  VendorDashboard,
  VendorPasswordStatus,
  VendorProduct,
  VendorProfile,
  VendorReview,
  VendorSlotDay,
  VendorStats,
} from '@rozbazaar/shared';
import { istDate } from '@rozbazaar/web';
import { api } from './client';
import { keys } from './keys';

export { keys };

export type VendorSession = SessionInfo<VendorProfile> & { needsRegistration: boolean };

export const useSession = () =>
  useQuery({
    queryKey: keys.session,
    queryFn: () => api.get<VendorSession>('/v1/vendor/session'),
    staleTime: 60_000,
  });

/** Orders for one day. Today's list is polled so new bookings show up without a refresh. */
export const useOrders = (date: string) =>
  useQuery({
    queryKey: keys.orders(date),
    queryFn: () => api.get<Booking[]>(`/v1/vendor/orders?date=${date}`),
    refetchInterval: date === istDate(0) || date === istDate(1) ? 20_000 : false,
  });

export const useStats = () =>
  useQuery({
    queryKey: keys.stats,
    queryFn: () => api.get<VendorStats>('/v1/vendor/stats?days=1'),
    refetchInterval: 60_000,
  });

export const useProducts = () =>
  useQuery({ queryKey: keys.products, queryFn: () => api.get<VendorProduct[]>('/v1/vendor/products') });

export const useCatalog = () =>
  useQuery({
    queryKey: keys.catalog,
    queryFn: () => api.get<CatalogItem[]>('/v1/vendor/catalog'),
    staleTime: 10 * 60_000,
  });

export const useSlots = (from: string, days: number) =>
  useQuery({
    queryKey: keys.slots(from),
    queryFn: () => api.get<VendorSlotDay[]>(`/v1/vendor/slots?from=${from}&days=${days}`),
  });

export const useSlotAreas = () =>
  useQuery({
    queryKey: keys.slotAreas,
    queryFn: () => api.get<Record<TimeSlot, string[] | null>>('/v1/vendor/slots/areas'),
  });

export const useDashboard = (from: string, to: string) =>
  useQuery({
    queryKey: keys.dashboard(from, to),
    queryFn: () => api.get<VendorDashboard>(`/v1/vendor/dashboard?from=${from}&to=${to}`),
  });

export const useReviews = () =>
  useQuery({ queryKey: keys.reviews, queryFn: () => api.get<VendorReview[]>('/v1/vendor/reviews?limit=30') });

export const usePasswordStatus = (enabled = true) =>
  useQuery({
    queryKey: keys.password,
    queryFn: () => api.get<VendorPasswordStatus>('/v1/vendor/password/status'),
    enabled,
  });

export const useAreas = () =>
  useQuery({
    queryKey: keys.areas,
    queryFn: () => api.get<Area[]>('/v1/public/areas'),
    staleTime: 10 * 60_000,
  });
