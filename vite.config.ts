import { defineConfig } from "vite";

// GitHub Pages project site: https://focarica.github.io/mermaid-to-fluxe/
const PAGES_BASE = "/mermaid-to-fluxe/";

export default defineConfig(({ mode }) => ({
  // Dev server keeps the root path; only production builds use the repo subpath.
  base: mode === "production" ? PAGES_BASE : "/",
}));
