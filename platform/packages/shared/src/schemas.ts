/**
 * Request schemas. The API validates every body/query with these before anything reaches
 * the database, and the web apps reuse them for form validation so the rules match.
 */
import { z } from 'zod';
import { LANGS, PAY_METHODS, TIME_SLOTS, VENDOR_SETTABLE_STATUSES, VENDOR_TYPES } from './enums.js';

/* ---------- primitives ---------- */

/** Indian mobile number: 10 digits starting 6-9. Accepts "+91 98123 45678" and strips it. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, '').slice(-10))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(60)
  .regex(/^[^<>{}]*$/, 'Name has invalid characters');

export const uuidSchema = z.string().uuid();

/** YYYY-MM-DD, sanity-bounded to 2020..2100. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      v >= '2020-01-01' &&
      v <= '2100-12-31'
    );
  }, 'Invalid date');

export const areaSchema = z.string().trim().min(1).max(60);
export const vendorTypeSchema = z.enum(VENDOR_TYPES);
export const timeSlotSchema = z.enum(TIME_SLOTS);
export const langSchema = z.enum(LANGS);
const money = z.number().finite().positive().max(100_000);
const shortText = (max: number) => z.string().trim().max(max);

/** Vendor product photos arrive as data URLs from the phone camera. ~300 KB decoded max. */
export const imageDataUrlSchema = z
  .string()
  .max(420_000, 'Photo is too large — pick a smaller one')
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, 'Photo must be a JPEG, PNG or WebP image');

/* ---------- public ---------- */

export const areaQuery = z.object({ area: areaSchema });
export const pointQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export const slotStatusQuery = z.object({ type: vendorTypeSchema, area: areaSchema, date: isoDateSchema });
export const availableVendorsQuery = slotStatusQuery.extend({ slot: timeSlotSchema });
export const vendorsForProductQuery = z.object({ area: areaSchema, name: z.string().trim().min(1).max(60) });
export const waitlistBody = z.object({ area: areaSchema, type: vendorTypeSchema, phone: phoneSchema });
export const contactBody = z.object({
  name: personNameSchema,
  body: z.string().trim().min(2).max(2000),
  phone: phoneSchema.optional(),
  email: z.string().trim().email().max(120).optional(),
});
export const visitBody = z.object({
  page: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_\-/]+$/i),
});

/* ---------- customer ---------- */

export const customerPhoneLoginBody = z.object({ name: personNameSchema, phone: phoneSchema });
export const customerProfileBody = z.object({ name: personNameSchema, phone: phoneSchema });

export const bookingItemSchema = z.object({
  productId: uuidSchema,
  qty: z.number().finite().positive().max(100),
});
export const createBookingBody = z.object({
  type: vendorTypeSchema,
  addressId: uuidSchema,
  date: isoDateSchema,
  slot: timeSlotSchema,
  items: z.array(bookingItemSchema).min(1, 'Your basket is empty').max(60),
  note: shortText(500).optional(),
  vendorId: uuidSchema.nullish(),
});

export const saveAddressBody = z
  .object({
    id: uuidSchema.optional(),
    label: shortText(40).optional(),
    house: shortText(80).optional(),
    street: shortText(120).optional(),
    landmark: shortText(120).optional(),
    area: areaSchema,
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    makeDefault: z.boolean().optional(),
  })
  .refine((a) => (a.lat == null) === (a.lng == null), {
    message: 'Both lat and lng are needed',
    path: ['lat'],
  });

export const rateBody = z.object({
  stars: z.number().int().min(1).max(5),
  comment: shortText(500).optional(),
});
export const reasonBody = z.object({ reason: z.string().trim().min(3, 'Please write a reason').max(500) });
export const langBody = z.object({ lang: langSchema });
export const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

export const pushSubscriptionBody = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith('https://'), 'Push endpoint must be https'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  agent: shortText(200).optional(),
});

/* ---------- vendor ---------- */

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers');

export const vendorLoginBody = z.object({ phone: phoneSchema, password: z.string().min(1).max(128) });
export const vendorPasswordBody = z.object({ password: passwordSchema });
export const dateQuery = z.object({ date: isoDateSchema });
export const rangeQuery = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((r) => r.from <= r.to, { message: '"from" must be before "to"', path: ['from'] })
  .refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 864e5 <= 400, {
    message: 'Range can be at most 400 days',
    path: ['to'],
  });

export const setStatusBody = z.object({ status: z.enum(VENDOR_SETTABLE_STATUSES) });
export const billItemSchema = z
  .object({
    itemId: uuidSchema.optional(),
    productId: uuidSchema.optional(),
    finalQty: z.number().finite().min(0).max(100),
    finalPrice: z.number().finite().min(0).max(100_000),
    removed: z.boolean().optional(),
  })
  .refine((i) => Boolean(i.itemId) !== Boolean(i.productId), 'Each line needs either itemId or productId');
export const finalizeBillBody = z.object({ items: z.array(billItemSchema).min(1).max(80) });
export const verifyOtpBody = z.object({ otp: z.string().regex(/^\d{4}$/, 'The code has 4 digits') });
export const paymentBody = z.object({ method: z.enum(PAY_METHODS), amount: money });
export const stockBody = z.object({ inStock: z.boolean() });
export const bulkPricesBody = z.object({
  prices: z
    .array(z.object({ id: uuidSchema, price: money }))
    .min(1)
    .max(200),
});
export const upsertProductBody = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1).max(60),
  nameHi: shortText(60).optional(),
  unit: z.string().trim().min(1).max(20),
  price: money,
  category: vendorTypeSchema,
  image: imageDataUrlSchema.optional(),
  /** Position in the vendor's list; send the current one when editing so it is kept. */
  sort: z.number().int().min(0).max(10_000).optional(),
});
export const activateCatalogBody = z.object({
  key: z.string().regex(/^p\d{1,4}$/),
  price: money,
  unit: shortText(20).optional(),
});
export const capacityBody = z.object({
  date: isoDateSchema,
  slot: timeSlotSchema,
  capacity: z.number().int().min(0).max(200),
  open: z.boolean(),
});
export const slotAreasBody = z.object({
  slot: timeSlotSchema,
  areas: z.array(areaSchema).max(50).nullable(),
});
export const vendorProfileBody = z
  .object({
    name: personNameSchema.optional(),
    shop: shortText(80).optional(),
    vehicle: shortText(60).optional(),
    areas: z.array(areaSchema).min(1).max(50).optional(),
    capacity: z.number().int().min(1).max(200).optional(),
    photo: imageDataUrlSchema.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Nothing to update');
export const activeBody = z.object({ active: z.boolean() });
export const vendorApplyBody = z.object({
  name: personNameSchema,
  phone: phoneSchema,
  type: vendorTypeSchema,
  areas: z.array(areaSchema).min(1).max(50),
  shop: shortText(80).optional(),
  vehicle: shortText(60).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  lang: langSchema.optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingBody>;
export type SaveAddressInput = z.infer<typeof saveAddressBody>;
export type FinalizeBillInput = z.infer<typeof finalizeBillBody>;
export type UpsertProductInput = z.infer<typeof upsertProductBody>;
export type VendorProfileInput = z.infer<typeof vendorProfileBody>;
