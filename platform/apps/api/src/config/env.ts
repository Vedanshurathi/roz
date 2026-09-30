/**
 * Configuration, validated once at start-up. The process refuses to boot with a bad or
 * missing value instead of failing later on the first request.
 */
import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_SECRET_PREVIOUS: z.string().min(32).optional(),

    PUBLIC_API_URL: z.string().url(),
    CUSTOMER_APP_URL: z.string().url(),
    VENDOR_APP_URL: z.string().url(),
    CORS_ORIGINS: csv,
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
    /** Upstream (Supabase) request timeout. */
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
  })
  .transform((e) => ({
    ...e,
    isProd: e.NODE_ENV === 'production',
    isTest: e.NODE_ENV === 'test',
    SUPABASE_URL: e.SUPABASE_URL.replace(/\/+$/, ''),
    PUBLIC_API_URL: e.PUBLIC_API_URL.replace(/\/+$/, ''),
    CUSTOMER_APP_URL: e.CUSTOMER_APP_URL.replace(/\/+$/, ''),
    VENDOR_APP_URL: e.VENDOR_APP_URL.replace(/\/+$/, ''),
  }))
  .superRefine((e, ctx) => {
    if (e.isProd) {
      for (const k of ['PUBLIC_API_URL', 'CUSTOMER_APP_URL', 'VENDOR_APP_URL'] as const) {
        if (!e[k].startsWith('https://'))
          ctx.addIssue({ code: 'custom', path: [k], message: 'must be https in production' });
      }
      if (!e.CORS_ORIGINS.length)
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'required in production' });
      if (e.CORS_ORIGINS.some((o) => o === '*' || !o.startsWith('https://')))
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'only explicit https origins are allowed in production',
        });
      if (!e.SUPABASE_SERVICE_ROLE_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'required in production',
        });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
