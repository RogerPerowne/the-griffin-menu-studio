import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite config for the Electron MAIN process.
// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      // Node built-ins and electron stay external in the main bundle.
      external: ['electron'],
    },
  },
});
