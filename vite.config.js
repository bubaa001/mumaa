import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        lovewing: resolve(root, "lovewing/index.html"),
      },
    },
  },
});
