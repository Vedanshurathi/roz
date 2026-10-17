import { pino, type Logger } from 'pino';
import type { Env } from '../config/env.js';

/** Paths that must never reach the logs (tokens, cookies, passwords, phone numbers in bodies). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.access_token',
  '*.refresh_token',
  '*.accessToken',
  '*.refreshToken',
  '*.otp',
];

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'isProd' | 'isTest' | 'LOG_TO_CONSOLE'>): Logger {
  const opts = {
    level: env.isTest ? 'silent' : env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'rozbazaar-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(env.isProd || env.isTest
      ? {}
      : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }),
  };
  if (env.LOG_TO_CONSOLE) {
    // Supabase Edge: no stdout file descriptor tricks, just console output (one JSON line each).
    const { transport: _t, ...plain } = opts as typeof opts & { transport?: unknown };
    // eslint-disable-next-line no-console -- this is the log sink on Supabase Edge
    return pino(plain, { write: (line: string) => console.log(line.trimEnd()) });
  }
  return pino(opts);
}
