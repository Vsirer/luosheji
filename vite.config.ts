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
