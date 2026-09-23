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

  test("separates entity clouds with long names and many attributes", () => {
    const crowdedDiagram = {
      entities: Array.from({ length: 3 }, (_, entityIndex) => ({
        name: `Entity ${entityIndex} with a particularly long descriptive name`,
        attributes: Array.from({ length: 12 }, (_, attributeIndex) => ({
          name: `attribute_${entityIndex}_${attributeIndex}_with_long_name`,
          keys: attributeIndex === 0 ? ["PK"] : [],
          type: "varchar(255)",
        })),
      })),
      relationships: [
        {
          from: "Entity 0 with a particularly long descriptive name",
          to: "Entity 1 with a particularly long descriptive name",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: false,
          label: "has a long relationship label",
        },
      ],
    };
    const layout = layoutDiagram(crowdedDiagram);
    const first = layout.entities[0];
    const second = layout.entities[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error("Expected three entity shapes");
    expect(first.x + first.width).toBeLessThan(second.x);
    expect(layout).toEqual(layoutDiagram(crowdedDiagram));
    expect(layout.bounds.width).toBeGreaterThan(second.x + second.width);
    for (const [index, attribute] of layout.attributes.entries()) {
      for (const other of layout.attributes.slice(index + 1)) {
        expect(
          attribute.x + attribute.width <= other.x ||
            other.x + other.width <= attribute.x ||
            attribute.y + attribute.height <= other.y ||
            other.y + other.height <= attribute.y,
        ).toBe(true);
      }
    }
    for (const attribute of layout.attributes) {
      expect(attribute.x).toBeGreaterThanOrEqual(layout.bounds.x);
      expect(attribute.x + attribute.width).toBeLessThanOrEqual(
        layout.bounds.x + layout.bounds.width,
      );
      expect(attribute.y).toBeGreaterThanOrEqual(layout.bounds.y);
      expect(
        attribute.y + attribute.height + (attribute.type ? 24 : 0),
      ).toBeLessThanOrEqual(layout.bounds.y + layout.bounds.height);
    }
  });

  test("keeps sparse and wide attribute ovals clear of their entity", () => {
    const fixtures = [
      [
        {
          name: "Entity",
          attributes: [
            { name: "id", keys: [] },
            {
              name: "a_wide_attribute_name_that_will_extend_sideways",
              keys: [],
            },
          ],
        },
      ],
      [
        {
          name: "Four attributes",
          attributes: [
            { name: "a_wide_attribute_id_name", keys: [] },
            { name: "a_wide_attribute_name_name", keys: [] },
            { name: "a_wide_attribute_email_name", keys: [] },
            { name: "a_wide_attribute_status_name", keys: [] },
          ],
        },
      ],
      [
        {
          name: "Wide oval",
          attributes: [
            { name: "attribute_name_that_is_extremely_wide", keys: [] },
          ],
        },
      ],
    ];
    for (const entities of fixtures) {
      const layout = layoutDiagram({ entities, relationships: [] });
      const shape = layout.entities[0];
      expect(shape).toBeDefined();
      if (!shape) throw new Error("Expected entity shape");
      for (const attribute of layout.attributes) {
        const separated =
          attribute.x + attribute.width < shape.x ||
          attribute.x > shape.x + shape.width ||
          attribute.y + attribute.height < shape.y ||
          attribute.y > shape.y + shape.height;
        expect(separated).toBe(true);
      }
      expect(layoutDiagram({ entities, relationships: [] })).toEqual(layout);
    }
  });

  test("routes self-relationship above entity without entering its bounds", () => {
    const selfDiagram = {
      entities: [{ name: "Loop", attributes: [] }],
      relationships: [
        {
          from: "Loop",
          to: "Loop",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: false,
          label: "revises",
        },
      ],
    };
    const layout = layoutDiagram(selfDiagram);
    const entity = layout.entities[0];
    const relationship = layout.relationships[0];
    expect(entity).toBeDefined();
    expect(relationship).toBeDefined();
    if (!entity || !relationship) throw new Error("Expected self relationship");
    expect(relationship.center.y + relationship.height / 2).toBeLessThan(
      entity.y,
    );
    expect(relationship.center.x).toBe(entity.x + entity.width / 2);
    expect(relationship.links[0]?.from.y).toBe(entity.y);
    expect(relationship.links[1]?.to.y).toBe(entity.y);
    expect(relationship.links[0]?.to.y).toBeGreaterThan(relationship.center.y);
    expect(relationship.links[1]?.from.y).toBeGreaterThan(
      relationship.center.y,
    );
    expect(layoutDiagram(selfDiagram)).toEqual(layout);
  });
});
