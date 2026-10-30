import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      manifest: false,
      includeAssets: ["favicon.svg", "icons/app-192.png", "icons/app-512.png"],
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
});
