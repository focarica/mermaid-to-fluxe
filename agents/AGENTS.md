# Project guidance

## Scope guard

Vite + vanilla TypeScript browser app (Bun 1.4.2). Parses a supported subset of Mermaid `erDiagram` into a static, handmade Chen-notation SVG preview and exports PNG.

- Do not promise complete Mermaid compatibility: the parser reports malformed/unsupported input with line-aware errors.
- MVP has no React, backend, or persistence. Limited session-only repositioning of an entity with its owned attributes is supported; arbitrary diagram editing and persistent positions remain out of scope and require separate discussion.
- Run the verification commands below locally before finishing (CI runs the same checks on push to `main`).

## Commands

```sh
bun install
bun run dev        # Vite dev server
bun test           # Bun test runner (--pass-with-no-tests)
bun run typecheck  # tsc --noEmit
bun run lint       # biome check . (lints AND checks format)
bun run build      # tsc --noEmit && vite build
```

- Single test file: `bun test src/parser/parser.test.js`
- Filter by name: `bun test -t "maps cardinality"`

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs test/typecheck/lint/build on every push to `main` and on manual dispatch, then publishes `dist/` to the `gh-pages` branch with `GITHUB_TOKEN` (branch-based Pages strategy, not the Pages Actions artifact deploy).

- Production `base` is `/mermaid-to-fluxe/` (set in `vite.config.ts` for `mode === "production"`); dev server stays at `/`.
- One-time repo setup: Settings → Pages → "Deploy from a branch" → branch `gh-pages`, folder `/(root)`.
- Live URL: <https://focarica.github.io/mermaid-to-fluxe/>

## Toolchain quirks

- Tests are plain `.test.js` colocated with sources under `src/`, and import `.ts` modules with extensionless paths (`./parser`). Bun runs the TS directly — do not rename tests to `.ts` or add a transpile step.
- `tsconfig.json` enables `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`. Optional fields must be conditionally spread — `...(value === undefined ? {} : { value })` — not assigned `undefined`.
- Biome config errors on `noExplicitAny`, `noDefaultExport` (exempts `vite.config.ts`), `useImportType`, `noUnusedImports`. Formatting: double quotes, semicolons, 2-space indent. `bun run lint` fails on format drift, so run it after edits.

## Architecture

Flow: **parse → layout → render**, no framework, DOM built from strings in `src/main.ts`.

- `index.html` loads `/src/main.ts` (the only entrypoint). It renders the workbench markup, wires live preview on input, and the PNG export (SVG → canvas → download).
- `src/parser/model.ts` — immutable `Diagram`/`Entity`/`Attribute`/`Relationship` types.
- `src/parser/parser.ts` — `parseErDiagram(source)`; throws `ErParseError` with the exact string `Line N: <message>`.
- `src/render/layout.ts` — `layoutDiagram(diagram)` computes geometry. Deterministic (no randomness here).
- `src/render/render.ts` — `renderDiagram(diagram, document?)` builds the SVG via Rough.js with fixed per-element `seed`s (deterministic output); `describeDiagram` builds the accessible text description.
- `src/style.css` — all design tokens (CSS custom properties).

## Conventions

- `DESIGN.md` is the visual and accessibility contract; `style.css` implements its tokens. Read it before any UI/style change.
- Rough.js seeds and hardcoded colors live in `render.ts`; keep them stable so SVG output stays deterministic.
- Parser tests assert the full `Line N: <message>` error text — preserve existing messages unless intentionally changing behavior.
