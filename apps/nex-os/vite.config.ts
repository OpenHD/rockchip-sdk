import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
// Proxy: durante `npm run dev`, las llamadas a /api/* se reenvían al servidor
// de Vercel local (`vercel dev` en el puerto 3000). Así el frontend de Vite
// y las funciones serverless corren juntos sin CORS ni rutas 404.
export default defineConfig({
  // VITE_* es el estándar; NEXT_PUBLIC_* queda por compatibilidad con deploys viejos
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: {
      '@nex-os/sdk': path.resolve(rootDir, 'packages/nex-os-sdk/src'),
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'isomorphic-git', '@monaco-editor/react'],
  },
  define: {
    'global': 'globalThis',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Si usás vercel dev en el 3000, esto redirige /api/groq/chat → http://localhost:3000/api/groq/chat
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
      '/hermes': {
        target: 'http://localhost:9119',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hermes/, ''),
        ws: true,
      },
    },
    fs: {
      allow: ['..'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        spotify: './nex-music.html',
        docs: './docs.html',
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) return 'three';
            if (id.includes('isomorphic-git') || id.includes('buffer')) return 'git';
            if (id.includes('framer-motion')) return 'motion';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    // Custom middleware for pretty routes (dev only)
    {
      name: 'custom-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url || ''
          if (url === '/nex-music' || url === '/nex-music/') {
            req.url = '/nex-music.html'
          } else if (url === '/docs' || url === '/docs/' || /^\/docs\?/.test(url)) {
            req.url = '/docs.html' + (url.includes('?') ? url.slice(url.indexOf('?')) : '')
          }
          next()
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'robots.txt'],
      manifest: {
        name: 'NEX Music',
        short_name: 'NEX Music',
        description: 'Reproductor social · YouTube + Spotify · salas en vivo',
        theme_color: '#020208',
        background_color: '#020208',
        display: 'standalone',
        orientation: 'any',
        start_url: '/nex-music',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Multi-page: don't let the SPA SW swallow /docs or /nex-music
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/docs(?:\/|$|\?)/,
          /^\/nex-music(?:\/|$|\?)/,
          /^\/api\//,
          /^\/share(?:\/|$|\?)/,
          /^\/p\//,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 20]
              }
            }
          }
        ]
      }
    })
  ],
})
