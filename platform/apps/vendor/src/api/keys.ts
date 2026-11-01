export const keys = {
  session: ['session'] as const,
  orders: (date: string) => ['orders', date] as const,
  allOrders: ['orders'] as const,
  stats: ['stats'] as const,
  products: ['products'] as const,
  catalog: ['catalog'] as const,
  slots: (from: string) => ['slots', from] as const,
  slotAreas: ['slot-areas'] as const,
  dashboard: (from: string, to: string) => ['dashboard', from, to] as const,
  reviews: ['reviews'] as const,
  password: ['password'] as const,
  areas: ['areas'] as const,
};
