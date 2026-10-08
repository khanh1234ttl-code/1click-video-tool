import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ mode }) => ({
  // Components use plain CSS; Vitest 2's Vite environment cannot run Vite 6 CSS preprocessing.
  plugins: [svelte(mode === "test" ? { configFile: false, preprocess: vitePreprocess({ style: false }) } : {})],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  resolve: { conditions: ["browser"] },
  test: { include: ["src/**/*.test.ts"], environment: "happy-dom" },
}));
