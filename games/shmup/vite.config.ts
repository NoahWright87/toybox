import { defineConfig } from "vite";

// Relative base so the bundle works wherever Doors 97 serves it.
// Build output goes straight into the Doors app's public/shmup/ so the
// root `vite build` copies it into the deployed site at /shmup/.
export default defineConfig({
  base: "./",
  build: {
    outDir: "../../public/shmup",
    emptyOutDir: true,
    target: "es2020",
  },
});
