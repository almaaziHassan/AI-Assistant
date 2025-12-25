import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'AIReceptionist',
      fileName: 'ai-receptionist-widget'
    },
    rollupOptions: {
      output: {
        assetFileNames: 'ai-receptionist-widget.[ext]'
      }
    }
  },
  define: {
    'process.env': {}
  }
});
