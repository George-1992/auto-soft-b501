import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path' // 1. Import Node's path module
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // Automatically activates new SW when deployed
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: process.env.VITE_PROJECT_NAME || 'example',
        short_name: process.env.VITE_PROJECT_NAME || 'example',
        description: '',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          // { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/images/logo/main.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['push-sw.js'],
      },

      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
