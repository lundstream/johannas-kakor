import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3050,
    host: true,
    strictPort: true,
    allowedHosts: ['kakor.lundstream.net', '.lundstream.net', 'localhost'],
  },
  preview: {
    port: 3050,
    host: true,
    strictPort: true,
    allowedHosts: ['kakor.lundstream.net', '.lundstream.net', 'localhost'],
  },
});
