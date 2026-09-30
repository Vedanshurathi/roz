/** Typed data hooks. Components never build URLs themselves. */
import { useQuery } from '@tanstack/react-query';
import type {
  Address,
  AppNotification,
  Area,
  Booking,
  BillPreview,
  CustomerProfile,
  HomeData,
  LastOrderItem,
  SessionInfo,
  SlotStatus,
  VendorCard,
  VendorType,
} from '@rozbazaar/shared';
import { api } from './client';

export const keys = {
  session: ['session'] as const,
  areas: ['areas'] as const,
  home: (area: string) => ['home', area] as const,
  vendors: (area: string) => ['vendors', area] as const,
  slots: (type: string, area: string, date: string) => ['slots', type, area, date] as const,
  addresses: ['addresses'] as const,
  bookings: ['bookings'] as const,
  bill: (id: string) => ['bill', id] as const,
  notifications: ['notifications'] as const,
  lastOrder: ['last-order'] as const,
};

export function useSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: () => api.get<SessionInfo<CustomerProfile>>('/v1/customer/session'),
    staleTime: 5 * 60_000,
  });
}

export function useAreas() {
  return useQuery({
    queryKey: keys.areas,
    queryFn: () => api.get<Area[]>('/v1/public/areas'),
    staleTime: 10 * 60_000,
  });
}

export function useHome(area: string | null, loggedIn: boolean) {
  return useQuery({
    queryKey: [...keys.home(area ?? ''), loggedIn],
    queryFn: () => api.get<HomeData>('/v1/customer/home', { area: area! }),
    enabled: Boolean(area),
    // Prices and stock change during the day; keep the catalogue fresh.
    refetchInterval: 3 * 60_000,
  });
}

export function useVendors(area: string | null) {
  return useQuery({
    queryKey: keys.vendors(area ?? ''),
    queryFn: () => api.get<VendorCard[]>('/v1/customer/vendors', { area: area! }),
    enabled: Boolean(area),
    staleTime: 5 * 60_000,
  });
}

export function useSlots(type: VendorType | null, area: string | null, date: string) {
  return useQuery({
    queryKey: keys.slots(type ?? '', area ?? '', date),
    queryFn: () => api.get<SlotStatus[]>('/v1/customer/slots', { type: type!, area: area!, date }),
    enabled: Boolean(type && area),
    staleTime: 20_000,
  });
}

export function useAddresses(enabled: boolean) {
  return useQuery({
    queryKey: keys.addresses,
    queryFn: () => api.get<Address[]>('/v1/customer/addresses'),
    enabled,
  });
}

export function useBookings(enabled: boolean) {
  return useQuery({
    queryKey: keys.bookings,
    queryFn: () => api.get<Booking[]>('/v1/customer/bookings', { limit: 30 }),
    enabled,
    // Live while an order is in progress, so the vendor's steps show up on their own.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((b) => !['completed', 'delivered', 'cancelled', 'missed'].includes(b.status))
        ? 20_000
        : false,
  });
}

export function useBill(id: string | null) {
  return useQuery({
    queryKey: keys.bill(id ?? ''),
    queryFn: () => api.get<BillPreview>(`/v1/customer/bookings/${id}/bill`),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => api.get<AppNotification[]>('/v1/customer/notifications', { limit: 30 }),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useLastOrder(enabled: boolean) {
  return useQuery({
    queryKey: keys.lastOrder,
    queryFn: () => api.get<LastOrderItem[]>('/v1/customer/last-order'),
    enabled,
  });
}
