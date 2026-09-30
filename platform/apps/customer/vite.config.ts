import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { hostingHeaders } from '@rozbazaar/web/hosting';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080';
  return {
    plugins: [react(), hostingHeaders({ apiUrl })],
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    build: { sourcemap: false, target: 'es2020', chunkSizeWarningLimit: 600 },
  };
});
