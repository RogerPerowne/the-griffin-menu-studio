import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite config for the renderer (the editor UI).
// Multi-page: the main editor (index.html) and the splash screen.
// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main_window: resolve(__dirname, 'index.html'),
        splash: resolve(__dirname, 'splash.html'),
      },
    },
  },
});
