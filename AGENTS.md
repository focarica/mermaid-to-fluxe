# Project guidance

## Current MVP

This is a Vite + vanilla TypeScript browser app, developed with Bun 1.4.2. TypeScript is strict; Biome handles linting and formatting; tests use Bun's test runner. The app parses a supported subset of Mermaid `erDiagram` input into a static, handmade Chen-notation preview and can export that diagram as PNG.

The parser supports common ER syntax and reports malformed or unsupported statements with line-aware errors. Do not promise complete Mermaid compatibility. The MVP has no React, backend, persistence, or diagram editing. Longer-term editing is product direction, not current functionality. Discuss scope with the user before extending beyond the MVP.

## Verification commands

```sh
bun install
bun run dev
bun test
bun run typecheck
bun run lint
bun run build
```
