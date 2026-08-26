import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'gentle-shape-7467/**'],
  },
  server: {
    host: '::',
    port: Number(process.env.PORT) || 8080,
  },
  plugins: [react(), ...(isDev ? [componentTagger()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // kB — default é 500
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor-react';
            if (id.includes('react-router')) return 'vendor-react';
            if (id.includes('@dnd-kit')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@radix-ui')) return 'vendor-ui';
            if (id.includes('leaflet')) return 'vendor-map';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('date-fns')) return 'vendor-date';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          }
        },
      },
    },
  },
});
