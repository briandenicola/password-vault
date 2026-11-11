import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // The app's settings keep their VUE_APP_ names (see .env.example). The same
  // names are read by Taskfile.yaml, scripts/*.ps1 and deploy.yml, so they are
  // exposed to the client under that prefix instead of Vite's default VITE_.
  envPrefix: 'VUE_APP_',
  plugins: [
    vue(),
    VitePWA({
      // The app registers the worker itself (src/registerServiceWorker.js) and
      // shows an in-app "update available" prompt that posts SKIP_WAITING, so
      // a new worker waits until the user opts in instead of taking over
      // mid-session.
      registerType: 'prompt',
      injectRegister: false,
      // Same file names the previous build produced, so installed clients
      // pick up the new worker and manifest at the URLs they already know.
      filename: 'service-worker.js',
      manifestFilename: 'manifest.json',
      // Icons are fetched on demand, as before, rather than precached.
      includeManifestIcons: false,
      manifest: {
        name: 'Password Vault',
        short_name: 'Vault',
        description: 'Secure family password vault with a bank-vault inspired PWA experience.',
        id: '/',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        categories: ['productivity', 'utilities'],
        theme_color: '#2d2417',
        background_color: '#f4efe7',
        icons: [
          { src: './img/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './img/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './img/icons/android-chrome-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: './img/icons/android-chrome-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache the app shell, styles and the PrimeIcons font files.
        globPatterns: ['**/*.{js,css,html,woff,woff2,ttf,eot,svg,txt}'],
        globIgnores: ['**/img/icons/**'],
        // The previous worker had no navigation fallback; keep it that way so
        // navigations (including the Entra ID redirect) always hit the network
        // or the precached index.html by URL.
        navigateFallback: null,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Same port as the previous dev server: http://localhost:8080 is the
  // redirect URI registered in Entra ID for local development.
  server: { port: 8080, strictPort: true },
  preview: { port: 8080, strictPort: true },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.js'],
  },
});
