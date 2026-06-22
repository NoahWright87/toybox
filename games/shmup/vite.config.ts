import { defineConfig } from "vite";

// Relative base so the built bundle works wherever Doors 97 serves it
// (e.g. /shmup/ or a hashed asset path). F1 finalizes the serve path.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
