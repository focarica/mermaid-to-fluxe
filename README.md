# Mermaid to Fluxe

Mermaid to Fluxe is a Vite + vanilla TypeScript browser app that turns supported Mermaid ER diagrams into a static, handmade Chen-notation preview. The generated drawing uses Rough.js SVG strokes and can be downloaded as PNG. It is a workbench for viewing and exporting diagrams, not an editor.

## Requirements and commands

Use Bun 1.4.2.

```sh
bun install
bun run dev        # Start the local Vite app
bun test           # Run the Bun test suite (currently 25 tests)
bun run typecheck  # Run strict TypeScript checking
bun run lint       # Run Biome checks
bun run build      # Typecheck and create the production build
```

## Input support

The parser accepts a common subset of Mermaid `erDiagram` syntax:

- `erDiagram` declarations, entity declarations, and entity attribute blocks
- Attribute types, `PK`, `FK`, and `UK` key flags, plus quoted comments
- Supported quoted entity, attribute, and relationship names or labels
- Common relationship/cardinality operators, including identifying and non-identifying connectors

Malformed and unsupported statements produce line-aware errors. This is not complete Mermaid grammar compatibility.

## Feature flow and scope

Edit Mermaid source in the workbench, parse it into entities, attributes, and relationships, then generate a static Chen diagram with entity rectangles, attribute ovals, relationship diamonds, key/type labels, and cardinality annotations. Correcting the source updates the preview. The browser export action downloads the generated diagram as PNG.

The MVP has no diagram editing, backend, or persistence. A future handmade editing experience is product direction and should be discussed separately before expanding scope. See [`DESIGN.md`](./DESIGN.md) for the visual and accessibility contract.
