import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      build: {
        sourcemap: false,
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 2000,
        minify: true,
        rollupOptions: {
          external: [
            'three',
            'three/examples/jsm/controls/OrbitControls',
            'three/examples/jsm/controls/TransformControls',
            'three/examples/jsm/objects/Reflector',
            'xlsx',
            'pdfjs-dist'
          ],
          output: {
            paths: {
              'three': 'https://esm.sh/three@0.183.2',
              'three/examples/jsm/controls/OrbitControls': 'https://esm.sh/three@0.183.2/examples/jsm/controls/OrbitControls.js',
              'three/examples/jsm/controls/TransformControls': 'https://esm.sh/three@0.183.2/examples/jsm/controls/TransformControls.js',
              'three/examples/jsm/objects/Reflector': 'https://esm.sh/three@0.183.2/examples/jsm/objects/Reflector.js',
              'xlsx': 'https://esm.sh/xlsx@0.18.5',
              'pdfjs-dist': 'https://esm.sh/pdfjs-dist@3.11.174'
            },
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('recharts') || id.includes('d3')) {
                  return 'charts';
                }
                if (id.includes('lucide-react')) {
                  return 'icons';
                }
                if (id.includes('motion')) {
                  return 'motion';
                }
                return 'vendor';
              }
            }
          }
        }
      },
      plugins: [react(), tailwindcss()],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './'),
        }
      }
    };
});
