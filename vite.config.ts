import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: VITE_BASE=/chipin-order/ saat build di CI; lokal tetap '/'.
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Chip!n Order — Pre-Order Premium',
        short_name: 'Chip!n Order',
        description:
          'Kelola pre-order komunitas: pesanan, pembayaran, pengiriman, dan rekap vendor dalam satu aplikasi.',
        lang: 'id',
        dir: 'ltr',
        theme_color: '#F4722B',
        background_color: '#FFFBF5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 5176,
  },
})
