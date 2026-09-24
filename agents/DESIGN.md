# Mermaid to Fluxe Design System

## 0. Research Log

- Embedded refs: shortlisted Miro, Figma, and Notion; picked the operational `taste-skill.md` execution guidance plus Miro as the workspace/canvas grammar because the MVP centers on inspecting a diagram alongside source. Handmade diagram stroke language comes from the user-named Excalidraw; no logos or assets are copied.
- Lazyweb: 2 queries, 1 screen actually viewed (Miro desktop workspace). Search terms: “Excalidraw diagram editor desktop” and “Miro visual workspace diagram canvas desktop”. The viewed screen supports a clear hierarchy of navigation, tool rail, large canvas, contextual panel, and floating canvas controls. Results were imperfect matches, so they inform only this broad grammar, not pixels or product styling.
- Imagen drafts: skipped because no image-generation tool is available in this environment.

## 1. Atmosphere & Identity

A warm, focused diagram workbench: quiet editor chrome gives the ERD room to breathe, while the diagram itself carries the tactile irregularity of a hand-drawn explanation. Signature: crisp, readable Chen notation with subtly imperfect ink strokes on a pale drafting surface. Mermaid source drives generated Chen notation; limited in-session repositioning moves each entity with owned attributes, without semantic editing or persistence.

## 2. Color

CSS custom properties are the implementation source; the names below are the contract. Start with the light palette. Dark-mode values are defined to preserve semantic mapping if a future theme is added, but a theme toggle is not in this bootstrap scope.

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| App background | `--color-workspace` | `#eee9df` | `#242522` | Outer editor surround |
| Primary surface | `--color-panel` | `#faf8f2` | `#30312d` | Source and action panels |
| Canvas surface | `--color-canvas` | `#fffdf7` | `#373832` | Diagram drawing area |
| Raised surface | `--color-raised` | `#ffffff` | `#41423c` | Menus and popovers |
| Primary ink | `--color-ink` | `#292a27` | `#f3f0e7` | Headings and diagram strokes |
| Secondary ink | `--color-ink-muted` | `#696a63` | `#c0bfb4` | Supporting labels |
| Quiet ink | `--color-ink-quiet` | `#696a63` | `#9c9c91` | Metadata and placeholders; 5.15:1 against the light panel (`#faf8f2`), exceeding 4.5:1 for small text |
| Panel edge | `--color-edge` | `#696a63` | `#50514b` | Panel boundaries and textarea control boundary; at least 3:1 against adjacent light surfaces (`#faf8f2`, `#fffdf7`) |
| Canvas grid | `--color-grid` | `#e7e2d7` | `#44453f` | Restrained drafting grid |
| Interactive accent | `--color-accent` | `#a64f36` | `#e18a6e` | Primary action and focus |
| Accent hover | `--color-accent-hover` | `#873d2b` | `#f0a087` | Hover/pressed action |
| Success | `--color-success` | `#397457` | `#82c49d` | Successful generation |
| Warning | `--color-warning` | `#956322` | `#e1b46c` | Cautions |
| Error | `--color-error` | `#a13e3a` | `#e58b84` | Parse errors |

Use the rust accent for actionable controls, not decoration. Diagram entity, relationship, and attribute forms share primary ink; semantics come from shape, label, and connector, not color alone. Error and status colors always accompany text or an icon.

## 3. Typography

Use locally available system fonts; no remote font dependency or font assets in the bootstrap. Display and UI use a humanist system sans stack (`ui-sans-serif, system-ui, sans-serif`); source and technical metadata use `ui-monospace, SFMono-Regular, monospace`.

| Level | Size | Weight | Line height | Use |
|---|---:|---:|---:|---|
| Page title | `1.5rem` | 650 | 1.2 | Document/workspace title |
| Panel title | `1rem` | 600 | 1.35 | Source, settings, export panels |
| Body | `0.875rem` | 400 | 1.5 | Instructions and labels |
| Source | `0.875rem` | 400 | 1.55 | Mermaid input |
| Caption | `0.75rem` | 500 | 1.4 | Hints and compact metadata |

The drawing uses the UI sans stack for legible labels and the mono stack only where a technical distinction benefits from it. Keep body and essential control text at or above 14px.

## 4. Spacing & Layout

Use a 4px base rhythm: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`. Use browser intrinsic sizing and `minmax()` where content dictates dimensions.

The editor shell is a three-zone composition: a compact source panel, a dominant canvas, and a narrow action area that can collapse below the source on small viewports. At desktop, source and canvas remain side by side, with the canvas taking the flexible remainder. The workbench fits the viewport height; diagram overflow scrolls within the canvas only, and source content scrolls inside its own panel. The SVG is non-editable. Diagrams start fitted to the canvas; users can zoom out to 1% and zoom in without a fixed upper limit. Manual zoom keeps the canvas center in focus. Fit recalculates for the current canvas size. At 375px, panels stack in task order and the canvas retains a useful minimum working height without forcing page-wide horizontal scrolling. Breakpoints: 640px, 768px, 1024px, 1280px.

## 5. Components

These contracts describe the implemented MVP workbench and Chen renderer. The source panel, diagram surface, and action controls follow the structure below. Real-browser visual QA is manual or Playwright-based; automated unit tests do not replace it.

### Source Panel
- **Structure**: labelled section, panel heading and concise helper/status line, labelled multiline editor with a syntax placeholder, a Paste action, and inline validation feedback.
- **Variants**: default, focused, invalid, empty, populated.
- **Spacing**: panel padding `--space-4`; field group gap `--space-2`; section gap `--space-4`.
- **States**: default, focus-visible, invalid, empty, and populated; source input remains editable.
- **Accessibility**: persistent visible label; editor keyboard reachable; errors identified in text and associated with the field; preserve selection and readable line height.
- **Motion**: no entrance animation required; focus and status transitions use opacity/color only.
- **Layout**: bounded sidebar with its own vertical scroll owner; stacks above canvas on narrow viewports. The editor starts empty, with its example syntax shown only as a placeholder.

### Diagram Canvas
- **Structure**: labelled, keyboard-focusable figure/work region, drawing surface, and empty and error explanation where appropriate.
- **Variants**: generated ERD, empty prompt, parse error, dense/large diagram; SVG structure is non-editable, with session-only entity-cluster repositioning.
- **Spacing**: canvas padding `--space-8`; controls cluster `--space-2`; canvas gutters can grow with viewport.
- **States**: default, empty, error, fitted, and manually zoomed.
- **Accessibility**: SVG includes title and description. Entity, relationship, and attribute groups are focusable, draggable, and keyboard-nudgeable; arrow keys on canvas continue scrolling. Touch supports pinch zoom, one-finger canvas panning, and dragging diagram items. Hover or focus traces connected groups and dims unrelated groups without removing them. Double-click or press Enter on a relationship to center its connected endpoints. Reset layout clears session offsets. Names retained through source edits retain positions; reload resets. Zoom, fit, and export remain available.
- **Motion**: diagram output remains still; zoom changes scale without animation.
- **Layout**: dominant flexible region; canvas owns scrolling and overflow, not the document. On narrow screens the canvas has a viewport-bounded height and begins at its top edge, with compact controls wrapping into rows.

### Action Controls
- **Structure**: source input updates the diagram preview live; semantic zoom in/out/fit controls, SVG export, and PNG download buttons.
- **Variants**: both export buttons and all zoom controls are disabled when no valid diagram is available; Fit scales the drawing to the current canvas viewport.
- **Spacing**: cluster gap `--space-2`; minimum hit target 44px.
- **States**: hover, active, focus-visible, disabled, and status feedback for valid or invalid source; no loading state.
- **Accessibility**: native buttons with descriptive names, visible keyboard focus, readable zoom percentage, status feedback announced without stealing focus.
- **Motion**: pressed feedback may use a small transform; state feedback is brief opacity/color. No decorative loops.
- **Layout**: action cluster in editor chrome, wraps or stacks below the source on narrow screens.

## 6. Motion & Interaction

Native SVG pointer gesture follows drag-gesture/pointer-capture mechanics: pointer coordinates convert through SVG CTM, movement recomputes cluster positions and connectors, and cancellation ends gesture. Keyboard arrows nudge focused clusters; reset clears offsets. Positions are in-memory only and reset on reload. No semantic diagram editing or persistence.

| Intent | Duration | Easing |
|---|---:|---|
| Control feedback | 120ms | `ease-out` |
| Panel/status transition | 200ms | `ease-in-out` |

Only animate `transform` and `opacity` for motion. Hover, active, and focus-visible must be distinguishable. No motion is required to understand diagram output. Under `prefers-reduced-motion: reduce`, transitions become immediate and nonessential movement is removed.

## 7. Depth & Surface

**Strategy: restrained mixed surfaces.** Use warm tonal contrast for the workbench and canvas. A thin tokenized edge separates fixed editor regions; one soft, warm-tinted shadow may lift floating controls above the canvas. The canvas itself stays visually flat and uncluttered apart from a low-contrast optional drafting grid. No ubiquitous cards, glass blur, or heavy shadows.

Radius tokens: `--radius-control: 6px`, `--radius-panel: 10px`, `--radius-floating: 12px`. Use the control radius for fields/buttons, panel radius for workspace panels, and floating radius for overlays. Do not round diagram geometry beyond the form required by Chen notation.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA: text contrast at least 4.5:1 (3:1 for large text), visible focus indicators, semantic landmarks, keyboard reachability, and 44px minimum pointer targets for primary controls.
- Respect browser zoom and text scaling; avoid fixed-height text containers. Preserve a clear reading order when panels stack.
- Expose validation and generation status in text, with appropriate live announcement; do not communicate state by color alone.
- Provide a text alternative for the diagram structure; canvas interaction must not become the only route to its content.
- Honor `prefers-reduced-motion`; avoid keyboard traps and maintain logical focus order.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Dark palette documented but no theme switch or dark-mode verification | MVP workbench | MVP runs in light mode; dark theme support is future scope | Revisit when adding theme support; no accessibility exception accepted |
