import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2020' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['chars/*.webp', 'icons/*.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,webp,png,json,svg}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      manifest: {
        name: 'パンしりとり かんじじゅくご',
        short_name: 'パンしりとり',
        description: '漢字の二字熟語をつなぐしりとりパズル',
        lang: 'ja',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fff7ea',
        theme_color: '#f4a261',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
