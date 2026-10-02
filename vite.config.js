import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/src/') || id.includes('/three/build/')) return 'three';
          if (id.includes('/three/examples/')) return 'effects';
        }
      }
    }
  }
});
