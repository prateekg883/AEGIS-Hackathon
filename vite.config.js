import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'client/src') },
  },
  root: path.resolve(process.cwd(), 'client'),
  build: {
    outDir: path.resolve(process.cwd(), 'dist/public'),
    emptyOutDir: true,
  },
  server: { port: 3000, host: true },
});
