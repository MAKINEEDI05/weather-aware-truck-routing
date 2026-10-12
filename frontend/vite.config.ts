/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache independently of app code.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            { name: 'map', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // UI tests drive whole pages through accessibility queries, whose cost grows with the DOM.
    // Headroom for slow or busy CI machines; assertions are unchanged.
    testTimeout: 15_000,
    css: false,
    restoreMocks: true,
    // Deterministic date formatting in tests (CDT/CST, like the design references).
    env: { TZ: 'America/Chicago' },
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
