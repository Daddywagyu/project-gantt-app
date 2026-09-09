import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build work when hosted in a subfolder (e.g. GitHub Pages project sites)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
