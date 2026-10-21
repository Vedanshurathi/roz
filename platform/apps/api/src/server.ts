import { loadEnv } from './config/env.js';
import { buildDeps, createApp } from './app.js';

const env = loadEnv();
const deps = buildDeps(env);
const app = createApp(deps);

const server = app.listen(env.PORT, () => {
  deps.logger.info({ port: env.PORT, env: env.NODE_ENV }, 'RozBazaar API listening');
});
// Slow-loris protection and keep-alive behind Render's proxy.
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 65_000;

function shutdown(signal: string): void {
  deps.logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => deps.logger.error({ err }, 'unhandled rejection'));
