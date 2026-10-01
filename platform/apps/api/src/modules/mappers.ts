/**
 * Database rows → API contracts. The DB shapes are snake_case and sometimes carry inline base64
 * photos; the API returns camelCase and photo URLs. Unknown/extra columns are dropped here, so a
 * new column never leaks to a browser by accident (e.g. otp_attempts, admin_note, auth_user_id).
 */
import type {
  Address,
  AppNotification,
  Area,
  AreaMatch,
  BillPreview,
  Booking,
  BookingItem,
  BookingStatus,
  CatalogItem,
  CustomerProfile,
  HomeData,
  Lang,
  LastOrderItem,
  PayMethod,
  Product,
  ProductVendorOption,
  SlotStatus,
  TimeSlot,
  VendorCard,
  VendorDashboard,
  VendorPasswordStatus,
  VendorProduct,
  VendorProfile,
  VendorReview,
  VendorSlotDay,
  VendorStats,
  VendorType,
} from '@rozbazaar/shared';
import type { ImageStore } from './images/image-store.js';

type Row = Record<string, unknown>;

export interface MapContext {
  images: ImageStore;
  apiUrl: string;
}

/* ---------- small coercers ---------- */
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const num0 = (v: unknown): number => num(v) ?? 0;
const bool = (v: unknown): boolean => v === true || v === 'true';
const arr = (v: unknown): Row[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Row[]) : [];
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const lang = (v: unknown): Lang | null => (v === 'en' || v === 'hi' ? v : null);

/** Only https images or our own cached data-URL images are ever handed to a browser. */
export function imageUrl(ctx: MapContext, raw: unknown, productId?: string | null): string | null {
  const s = str(raw);
  if (!s) return null;
  if (s.startsWith('https://')) return s;
  if (s.startsWith('data:image/')) {
    const hash = ctx.images.put(s);
    if (!hash) return null;
    const q = productId ? `?p=${encodeURIComponent(productId)}` : '';
    return `${ctx.apiUrl}/v1/img/${hash}${q}`;
  }
  return null;
}

const productPhoto = (ctx: MapContext, r: Row): string | null =>
  imageUrl(ctx, r.image_url, str(r.id)) ?? imageUrl(ctx, r.stock_image_url);

/* ---------- public / catalogue ---------- */

export function mapArea(r: Row): Area {
  return {
    name: String(r.name ?? ''),
    lat: num(r.lat),
    lng: num(r.lng),
    radiusKm: num(r.radius_km),
    served: bool(r.served),
  };
}

export function mapAreaMatch(r: Row | null): AreaMatch {
  const x = r ?? {};
  return {
    area: str(x.area) ?? str(x.name),
    inRange: bool(x.in_range),
    served: bool(x.served),
    confident: bool(x.confident),
    distanceKm: num(x.distance_km),
  };
}

export function mapProduct(ctx: MapContext, r: Row): Product {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    nameEn: str(r.name_en),
    nameHi: str(r.name_hi),
    unit: String(r.unit ?? ''),
    price: num0(r.price),
    category: (str(r.category) ?? 'vegetable') as VendorType,
    inStock: r.in_stock !== false,
    imageUrl: productPhoto(ctx, r),
    vendorId: String(r.vendor_id ?? ''),
    vendorName: str(r.vendor_name),
    vendorRating: num(r.vendor_rating),
    catalogKey: str(r.catalog_key),
    priceUpdatedAt: str(r.price_updated_at),
  };
}

export function mapHome(ctx: MapContext, r: Row): HomeData {
  return {
    area: String(r.area ?? ''),
    areas: strArr(r.areas),
    served: bool(r.served),
    types: arr(r.types).map((t) => ({
      type: String(t.v_type) as VendorType,
      vendorCount: num0(t.vendor_count),
      avgRating: num(t.avg_rating),
    })),
    products: arr(r.products).map((p) => mapProduct(ctx, p)),
    favourites: strArr(r.favourites).length
      ? strArr(r.favourites)
      : arr(r.favourites)
          .map((f) => String(f.product_id ?? f.id ?? ''))
          .filter(Boolean),
  };
}

export function mapSlot(r: Row): SlotStatus {
  return {
    slot: String(r.slot) as TimeSlot,
    starts: String(r.starts ?? ''),
    ends: String(r.ends ?? ''),
    free: num0(r.free),
    isPast: bool(r.is_past),
    hasRoom: bool(r.has_room),
  };
}

export function mapVendorCard(ctx: MapContext, r: Row): VendorCard {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    type: (str(r.v_type) as VendorType | null) ?? null,
    photoUrl: imageUrl(ctx, r.photo_url),
    avgRating: num(r.avg_rating),
    totalRatings: num0(r.total_ratings),
    ordersCompleted: num(r.orders_completed),
    productCount: num(r.product_count),
    booked: num(r.booked),
    capacity: num(r.capacity),
  };
}

export function mapProductVendor(r: Row): ProductVendorOption {
  return {
    vendorId: String(r.id),
    vendorName: String(r.name ?? ''),
    productId: String(r.product_id),
    price: num0(r.price),
    unit: String(r.unit ?? ''),
    inStock: r.in_stock !== false,
    avgRating: num(r.avg_rating),
    totalRatings: num0(r.total_ratings),
  };
}

/* ---------- customer ---------- */

export function mapCustomer(r: Row | null): CustomerProfile | null {
  if (!r || !r.id) return null;
  return {
    id: String(r.id),
    name: str(r.name),
    phone: str(r.phone),
    email: str(r.email),
    lang: lang(r.lang),
  };
}

export function mapAddress(r: Row): Address {
  return {
    id: String(r.id),
    label: str(r.label),
    house: str(r.house_no),
    street: str(r.street),
    landmark: str(r.landmark),
    area: String(r.area ?? ''),
    lat: num(r.lat),
    lng: num(r.lng),
    isDefault: bool(r.is_default),
  };
}

function mapItem(ctx: MapContext, r: Row): BookingItem {
  const productId = str(r.product_id);
  return {
    id: String(r.id),
    productId,
    name: String(r.product_name ?? r.name ?? ''),
    unit: String(r.unit ?? ''),
    qty: num0(r.qty),
    finalQty: num(r.final_qty),
    price: num0(r.price_at_booking ?? r.price),
    finalPrice: num(r.final_price),
    removed: bool(r.removed),
    addedAtDoor: bool(r.added_at_door),
    imageUrl: imageUrl(ctx, r.image_url, productId) ?? imageUrl(ctx, r.stock_image_url),
  };
}

export function mapBooking(ctx: MapContext, r: Row, viewer: 'customer' | 'vendor'): Booking {
  const addressLine = [r.house_no, r.street, r.area].map(str).filter(Boolean).join(', ');
  return {
    id: String(r.id),
    code: String(r.code ?? ''),
    status: String(r.status) as BookingStatus,
    type: (str(r.v_type) ?? 'vegetable') as VendorType,
    date: String(r.booking_date ?? ''),
    slot: (str(r.slot) ?? 'morning') as TimeSlot,
    area: String(r.area ?? ''),
    addressLine,
    addressLabel: str(r.addr_label),
    landmark: str(r.landmark),
    lat: num(r.lat),
    lng: num(r.lng),
    note: str(r.note),
    vendorId: str(r.vendor_id),
    vendorName: str(r.vendor_name),
    customerName: str(r.customer_name),
    counterpartPhone: viewer === 'customer' ? str(r.vendor_phone) : str(r.customer_phone),
    estTotal: num0(r.est_total),
    finalTotal: num(r.final_total),
    payAmount: num(r.pay_amount),
    payMethod: (str(r.pay_method) as PayMethod | 'online' | null) ?? null,
    deliveryOtp: viewer === 'customer' ? str(r.delivery_otp) : null,
    ratingStars: num(r.rating_stars),
    cancelReason: str(r.cancel_reason),
    disputeReason: str(r.dispute_reason),
    mapsUrl: viewer === 'vendor' && str(r.maps_url)?.startsWith('https://') ? str(r.maps_url) : null,
    items: arr(r.items).map((i) => mapItem(ctx, i)),
    createdAt: String(r.created_at ?? ''),
  };
}

export function mapBill(ctx: MapContext, r: Row): BillPreview {
  return {
    code: String(r.code ?? ''),
    status: String(r.status) as BookingStatus,
    estTotal: num0(r.est_total),
    finalTotal: num0(r.final_total),
    lines: arr(r.changes).map((c) => {
      const kind = String(c.change_kind ?? 'same');
      return {
        itemId: String(c.item_id),
        name: String(c.product_name ?? ''),
        unit: String(c.unit ?? ''),
        bookedQty: num0(c.booked_qty),
        finalQty: num0(c.final_qty),
        bookedPrice: num0(c.booked_price),
        finalPrice: num0(c.final_price),
        delta: num0(c.delta),
        change: (bool(c.removed)
          ? 'removed'
          : ['same', 'changed', 'added', 'removed'].includes(kind)
            ? kind
            : 'changed') as BillPreview['lines'][number]['change'],
        imageUrl: imageUrl(ctx, c.image_url),
      };
    }),
  };
}

export function mapNotification(r: Row): AppNotification {
  const titleHi = str(r.title) ?? '';
  const msgHi = str(r.message) ?? '';
  const url = str(r.url);
  return {
    id: String(r.id),
    type: String(r.type ?? ''),
    title: { hi: titleHi, en: str(r.title_en) ?? titleHi },
    message: { hi: msgHi, en: str(r.message_en) ?? msgHi },
    isRead: bool(r.is_read),
    bookingId: str(r.booking_id),
    url: url && url.startsWith('https://') ? url : null,
    createdAt: String(r.created_at ?? ''),
  };
}

export function mapLastOrderItem(ctx: MapContext, r: Row): LastOrderItem {
  const productId = String(r.product_id ?? '');
  return {
    productId,
    name: String(r.name ?? ''),
    unit: String(r.unit ?? ''),
    qty: num0(r.qty),
    imageUrl: imageUrl(ctx, r.image_url, productId),
  };
}

/* ---------- vendor ---------- */

export function mapVendor(ctx: MapContext, r: Row | null): VendorProfile | null {
  if (!r || !r.id) return null;
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    phone: str(r.phone),
    type: (str(r.v_type) ?? 'vegetable') as VendorType,
    status: String(r.status ?? ''),
    isActive: bool(r.is_active),
    shopName: str(r.shop_name),
    vehicle: str(r.vehicle),
    photoUrl: imageUrl(ctx, r.photo_url),
    areas: strArr(r.areas_served),
    avgRating: num(r.avg_rating),
    totalRatings: num0(r.total_ratings),
    totalOrders: num0(r.total_orders),
    defaultCapacity: num(r.default_capacity) ?? 15,
    lang: lang(r.lang),
  };
}

export function mapVendorProduct(ctx: MapContext, r: Row): VendorProduct {
  const p = mapProduct(ctx, r);
  const { vendorId: _v, vendorName: _n, vendorRating: _r, ...rest } = p;
  return {
    ...rest,
    reviewStatus: str(r.review_status),
    reviewNote: str(r.review_note),
    priceIsStale: bool(r.price_is_stale),
    sortOrder: num0(r.sort_order),
  };
}

export function mapCatalogItem(ctx: MapContext, r: Row): CatalogItem {
  return {
    key: String(r.key),
    name: String(r.name_en ?? r.name ?? ''),
    nameEn: str(r.english_name),
    nameHi: str(r.name_hi),
    unit: str(r.default_unit),
    category: (str(r.category) ?? 'vegetable') as VendorType,
    imageUrl: imageUrl(ctx, r.image_url),
  };
}

export function mapVendorSlot(r: Row): VendorSlotDay {
  return {
    date: String(r.slot_date ?? ''),
    slot: String(r.slot) as TimeSlot,
    isOpen: r.is_open !== false,
    capacity: num0(r.capacity),
    booked: num0(r.booked_count),
  };
}

export function mapReview(r: Row): VendorReview {
  return {
    stars: num0(r.stars),
    comment: str(r.comment),
    customerName: str(r.customer_name),
    createdAt: String(r.created_at ?? ''),
  };
}

export function mapStats(r: Row): VendorStats {
  return {
    sales: num0(r.sales),
    completed: num0(r.completed),
    avgRating: num(r.avg_rating),
    todaySale: num0(r.today_sale),
    todayOrders: num0(r.today_orders),
    todayPending: num0(r.today_pending),
    totalRatings: num0(r.total_ratings),
    stalePrices: num0(r.stale_prices),
    commissionRate: num0(r.commission_rate),
  };
}

export function mapDashboard(r: Row): VendorDashboard {
  return {
    from: String(r.from ?? ''),
    to: String(r.to ?? ''),
    sale: num0(r.sale),
    orders: num0(r.orders),
    avg: num0(r.avg),
    cash: num0(r.cash),
    upi: num0(r.upi),
    other: num0(r.other),
    commission: num0(r.commission),
    net: num0(r.net),
    rate: num0(r.rate),
    booked: num0(r.booked),
    cancelled: num0(r.cancelled),
    missed: num0(r.missed),
    open: num0(r.open),
    rating: num(r.rating),
    ratings: num0(r.ratings),
    monthly: bool(r.monthly),
    monthSale: num0(r.month_sale),
    monthCommission: num0(r.month_commission),
    chart: arr(r.chart).map((c) => ({
      date: String(c.d ?? ''),
      total: num0(c.total),
      orders: num0(c.orders),
    })),
    items: arr(r.items).map((i) => ({
      name: String(i.name ?? ''),
      unit: str(i.unit),
      qty: num0(i.qty),
      amount: num0(i.amount),
    })),
    list: arr(r.list).map((l) => ({
      code: String(l.code ?? ''),
      date: String(l.d ?? ''),
      slot: (str(l.slot) as TimeSlot | null) ?? null,
      amount: num0(l.amount),
      method: str(l.method),
      customerName: str(l.customer),
    })),
  };
}

export function mapPasswordStatus(r: Row): VendorPasswordStatus {
  const req = r.request && typeof r.request === 'object' ? (r.request as Row) : null;
  return {
    hasPassword: bool(r.has_password),
    request: req
      ? {
          status: String(req.status ?? ''),
          createdAt: String(req.created_at ?? ''),
          decidedAt: str(req.decided_at),
        }
      : null,
  };
}
