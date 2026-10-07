import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // ADR 0042: `vite --mode pwa-dev` registers the plugin's development
        // service worker, so the real offline-ready toast (ReloadPrompt) shows
        // under a dev server. Playwright's second webServer runs it for
        // `toast-layering.spec.ts`; `npm run dev` and `vite build` never set
        // this mode, so neither changes. `suppressWarnings` silences workbox's
        // "glob patterns match no files": a dev server has no build to precache.
        devOptions: { enabled: mode === 'pwa-dev', suppressWarnings: true },
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'FinLife Tracker',
          short_name: 'FinLife',
          description: 'A personal finance and lifestyle tracking application with multi-wallet management, smart categorization, debt tracking, and a daily diary.',
          theme_color: '#121824',
          background_color: '#0B0E14',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Quick Add Transaction',
              short_name: 'Quick Add',
              description: 'Quickly record an expense or income',
              url: '/?action=quick-add',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // T7: splits heavy vendor libraries out of the single ~1.1MB entry
          // chunk into their own chunks. Vendor code changes far less often
          // than app code, so browsers can cache these across deploys, and
          // the browser can fetch them in parallel instead of one giant
          // blocking chunk. Per-view code (React.lazy in App.tsx) already
          // splits on its own - this only targets node_modules.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;

            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            // tslib's one user since framer-motion went is supabase-js (ADR 0082).
            if (id.includes('node_modules/@supabase/') || id.includes('node_modules/tslib/')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
