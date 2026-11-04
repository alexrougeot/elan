import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// L'app est publiée sur GitHub Pages à l'adresse https://alexrougeot.github.io/elan/
export default defineConfig({
  base: '/elan/',
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'data/aliments.json'],
      manifest: {
        name: 'Élan',
        short_name: 'Élan',
        description: 'Sport, nutrition et bien-être : tes séances, tes repas et ta progression.',
        lang: 'fr',
        start_url: '/elan/',
        scope: '/elan/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F7F6',
        theme_color: '#F4F7F6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/elan/index.html',
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('openfoodfacts.org') && url.pathname.includes('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'off-images', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
    }),
  ],
});
