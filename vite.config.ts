import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3050,
    host: true,
    strictPort: true,
    allowedHosts: ['enkeletikett.se', '.enkeletikett.se', 'kakor.lundstream.net', '.lundstream.net', 'localhost'],
    proxy: {
      '/api': 'http://localhost:3060',
    },
  },
  preview: {
    port: 3050,
    host: true,
    strictPort: true,
    allowedHosts: ['enkeletikett.se', '.enkeletikett.se', 'kakor.lundstream.net', '.lundstream.net', 'localhost'],
  },
});
