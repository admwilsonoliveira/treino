import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"],
      manifest: {
        name: "Treino",
        short_name: "Treino",
        description: "Registro de musculação, caminhada e evolução física.",
        lang: "pt-BR",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#eef2f4",
        theme_color: "#0f6b63",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ]
});
