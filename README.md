# Mermaid to Fluxe

Mermaid to Fluxe is a Vite + vanilla TypeScript browser app that turns supported Mermaid ER diagrams into a static, handmade Chen-notation preview. The generated drawing uses Rough.js SVG strokes and can be downloaded as vector SVG or high-resolution PNG. It is a workbench for viewing and exporting diagrams, not an editor.

## Requirements and commands

Use Bun 1.4.2.

```sh
bun install
bun run dev        # Start the local Vite app
bun test           # Run the Bun test suite
bun run typecheck  # Run strict TypeScript checking
bun run lint       # Run Biome checks
bun run build      # Typecheck and create the production build
```

## Input support

The parser accepts a common subset of Mermaid `erDiagram` syntax:

- `erDiagram` declarations, entity declarations, and entity attribute blocks
- Attribute types, `PK`, `FK`, and `UK` key flags, plus quoted comments
- Chen extensions: `DERIVED`, `COMPOSITE(part, ...)`, and relationship attribute blocks
- Supported quoted entity, attribute, and relationship names or labels
- Common relationship/cardinality operators, including identifying and non-identifying connectors

Malformed and unsupported statements produce line-aware errors. This is not complete Mermaid grammar compatibility.

Chen extensions keep the Mermaid-style entity blocks and add explicit markers for forms that Mermaid ER syntax does not express:

```text
PERSON {
  int age DERIVED
  string address COMPOSITE(street, city)
}
PERSON ||--o{ JOB : holds
RELATIONSHIP holds {
  date started_at
}
```

Relationship attribute blocks attach to a relationship by its label, which must identify exactly one relationship. Composite component names become connected sub-ovals; derived attributes use a dashed oval.

## Feature flow and scope

Edit Mermaid source in the workbench, parse it into entities, attributes, and relationships, then generate a static Chen diagram with entity rectangles, attribute ovals, relationship diamonds, key/type labels, and cardinality annotations. Correcting the source updates the preview. The canvas starts fitted to the available view; zoom-in has no fixed upper bound and keeps the canvas center in focus. Hover or keyboard-focus an item to trace its connected entities and relationships while dimming unrelated items. Click an item or press Space to pin its trace; a persistent cue names the node included in exports. Click/Space again or choose Clear trace to unpin. Pins override hover/focus, survive source edits while their `data-position-key` remains, and are included in full-diagram SVG/PNG exports. Export SVG to preserve sharp vector detail at any zoom, or PNG for a high-resolution raster image.

The MVP has no diagram editing, backend, or persistence. A future handmade editing experience is product direction and should be discussed separately before expanding scope. See [`DESIGN.md`](./DESIGN.md) for the visual and accessibility contract.
