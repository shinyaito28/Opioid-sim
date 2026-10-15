import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import {APP_CHROME_COLOR,APP_SHELL_URL} from './src/lib/appShell.js';

// Fetch a distinct HTML URL when updating an installed PWA's app shell.
const appShellUrl = APP_SHELL_URL;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon-32.png'],
      manifest: {
        name: 'Anesthesia PK/PD Simulator',
        short_name: 'AnesthesiaSim',
        description: 'PK/PD simulator for opioids and sedatives — research/educational use only',
        theme_color: APP_CHROME_COLOR,
        background_color: APP_CHROME_COLOR,
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        modifyURLPrefix: { 'index.html': appShellUrl.slice(1) },
        navigateFallback: appShellUrl,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'opioid-sim-images',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
