import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteApiPlugin } from './server/vite-api-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
