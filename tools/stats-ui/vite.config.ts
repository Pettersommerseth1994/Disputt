// The owner's page of numbers (public/stats/): built here with shadcn/ui and written into public/stats/, which is committed, so that
// the site's own build (tools/pages/build.mjs) stays a plain copy. Rebuild with `npm run stats:build` from the project root. docs/STATS.md.
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "./", // (the site may live under a path, as on github.io/<user>/Disputt/)
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@math": path.resolve(__dirname, "../../public/js/stats-math.js"), // the sums are the same file the tests run
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: { outDir: "../../public/stats", emptyOutDir: true },
})
