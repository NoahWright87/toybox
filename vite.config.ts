import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Ensure a single copy of React resolves from the root node_modules
// (prevents "Invalid hook call" when worktree has its own node_modules)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
    },
  },
});
