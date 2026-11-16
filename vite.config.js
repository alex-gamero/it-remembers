import { defineConfig } from 'vite';

// base './' makes the build work from any folder, which itch.io needs.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
