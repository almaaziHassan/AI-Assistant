import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Explicit SPA configuration - NOT a library!
export default defineConfig({
  plugins: [react()],
  build: {
    // Explicitly set to false to prevent library mode
    lib: false as any,
    outDir: 'dist',
    emptyOutDir: true,
    // Generate index.html-based SPA
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
