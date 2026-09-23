import { describe, expect, test } from "bun:test";
import { layoutDiagram } from "./layout";

const diagram = {
  entities: [
    {
      name: "Customer",
      attributes: [
        { name: "customer_id", keys: ["PK"] },
        { name: "display_name", keys: [] },
      ],
    },
    { name: "Purchase", attributes: [{ name: "purchase_id", keys: ["PK"] }] },
  ],
  relationships: [
    {
      from: "Customer",
      to: "Purchase",
      fromCardinality: "one",
      toCardinality: "zero-or-more",
      identifying: false,
      label: "places",
    },
  ],
};

describe("layoutDiagram", () => {
  test("places entities, relation, attributes, and both endpoint links", () => {
    const layout = layoutDiagram(diagram);
    expect(layout.entities).toHaveLength(2);
    expect(layout.relationships).toHaveLength(1);
    expect(layout.relationships[0]?.links).toHaveLength(2);
    expect(layout.attributes).toHaveLength(3);
    expect(layout.bounds.width).toBeGreaterThan(0);
    expect(layout.bounds.height).toBeGreaterThan(0);
  });

  test("is deterministic and keeps long content within expanded bounds", () => {
    const longDiagram = {
      entities: [
        {
          name: "A remarkably long entity name",
          attributes: [
            {
              name: "an_attribute_name_that_is_deliberately_very_long",
              keys: ["PK", "UK"],
            },
          ],
        },
      ],
      relationships: [],
    };
    const first = layoutDiagram(longDiagram);
    expect(layoutDiagram(longDiagram)).toEqual(first);
    expect(first.bounds.width).toBeGreaterThan(400);
    expect(first.bounds.x).toBeLessThan(first.entities[0]?.x ?? 0);
  });
});
