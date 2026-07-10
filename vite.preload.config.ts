import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite config for the preload script.
// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
