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

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'isProd' | 'isTest'>): Logger {
  return pino({
    level: env.isTest ? 'silent' : env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'rozbazaar-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(env.isProd || env.isTest
      ? {}
      : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }),
  });
}
