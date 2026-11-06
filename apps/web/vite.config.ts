import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/main.tsx so the desktop shell (Tauri) never installs
      // a service worker. A service worker on tauri.localhost can keep serving
      // stale bundles after an app upgrade.
      injectRegister: false,
      includeAssets: [],
      manifest: {
        name: 'Dayline',
        short_name: 'Dayline',
        description: '本地优先的任务与时间管理',
        theme_color: '#3b6ef6',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: {
      allow: ['../..'],
    },
  },
  preview: {
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
