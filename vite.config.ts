/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteCompression from "vite-plugin-compression";

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      apply: "build",
      threshold: 1024,
    }),
  ],
  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },
  build: {
    chunkSizeWarningLimit: 1800,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Keep engine CSS separate so it doesn't force-load the large engine JS chunk on landing.
          if (
            id.endsWith(".css") &&
            (id.includes("mapbox-gl") || id.includes("maplibre-gl"))
          ) {
            return "map-engines-css";
          }

          if (id.includes("mapbox-gl") || id.includes("maplibre-gl")) {
            return "map-engines";
          }
          if (id.includes("@turf/") || id.includes("/@turf")) return "geo";
          if (id.includes("react-syntax-highlighter")) return "code";
          if (id.includes("framer-motion") || id.includes("lucide-react")) {
            return "ui";
          }

          return "vendor";
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
