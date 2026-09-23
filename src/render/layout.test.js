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
  test("uses relationship topology to place connected neighbors in 2D", () => {
    const branching = {
      entities: ["Root", "Leaf A", "Leaf B", "Leaf C", "Tail", "Island"].map(
        (name) => ({
          name,
          attributes: [],
        }),
      ),
      relationships: [
        {
          from: "Root",
          to: "Leaf A",
          fromCardinality: "one",
          toCardinality: "one",
          identifying: false,
          label: "a",
        },
        {
          from: "Root",
          to: "Leaf B",
          fromCardinality: "one",
          toCardinality: "one",
          identifying: false,
          label: "b",
        },
        {
          from: "Root",
          to: "Leaf C",
          fromCardinality: "one",
          toCardinality: "one",
          identifying: false,
          label: "d",
        },
        {
          from: "Leaf A",
          to: "Tail",
          fromCardinality: "one",
          toCardinality: "one",
          identifying: false,
          label: "c",
        },
      ],
    };
    const layout = layoutDiagram(branching);
    const byName = new Map(
      layout.entities.map((entity) => [entity.name, entity]),
    );
    const root = byName.get("Root");
    const leafA = byName.get("Leaf A");
    const leafB = byName.get("Leaf B");
    expect(root).toBeDefined();
    expect(leafA).toBeDefined();
    expect(leafB).toBeDefined();
    if (!root || !leafA || !leafB) throw new Error("Expected branch entities");
    expect(
      new Set(layout.entities.map((entity) => entity.y)).size,
    ).toBeGreaterThan(1);
    const siblings = [leafA, leafB, byName.get("Leaf C")];
    const siblingRows = siblings.map((entity) => entity.y);
    expect(Math.min(...siblingRows)).toBeLessThan(root.y);
    expect(Math.max(...siblingRows)).toBeGreaterThan(root.y);
    expect(
      siblingRows.reduce((sum, row) => sum + row, 0) / siblingRows.length,
    ).toBeCloseTo(root.y);
    const orderedSiblingRows = [...siblingRows].sort(
      (left, right) => left - right,
    );
    const siblingGaps = orderedSiblingRows
      .slice(1)
      .map((row, index) => row - (orderedSiblingRows[index] ?? row));
    const gridGap = Math.min(...siblingGaps);
    expect(gridGap).toBeGreaterThan(100);
    const distance = (left, right) =>
      Math.hypot(
        left.x + left.width / 2 - right.x - right.width / 2,
        left.y + left.height / 2 - right.y - right.height / 2,
      );
    const connectedMean =
      (distance(root, leafA) +
        distance(root, leafB) +
        distance(root, byName.get("Leaf C")) +
        distance(leafA, byName.get("Tail"))) /
      4;
    const localNonEdges = [
      distance(root, byName.get("Tail")),
      distance(leafA, leafB),
      distance(leafB, byName.get("Tail")),
      distance(byName.get("Leaf C"), byName.get("Tail")),
    ];
    expect(connectedMean).toBeLessThan(
      localNonEdges.reduce((sum, current) => sum + current, 0) /
        localNonEdges.length,
    );
    expect(layout).toEqual(layoutDiagram(branching));
    const reordered = {
      ...branching,
      entities: [...branching.entities].reverse(),
    };
    const reorderedLayout = layoutDiagram(reordered);
    const rootShape = layout.entities.find((entity) => entity.name === "Root");
    const reorderedRoot = reorderedLayout.entities.find(
      (entity) => entity.name === "Root",
    );
    expect(rootShape).toBeDefined();
    expect(reorderedRoot).toBeDefined();
    if (!rootShape || !reorderedRoot) throw new Error("Expected stable root");
    expect(rootShape.x).toBe(reorderedRoot.x);
    expect(rootShape.y).toBe(reorderedRoot.y);
    expect(byName.get("Tail")?.y).toBe(leafA.y);
    const entityRows = layout.entities
      .filter((entity) => entity.name !== "Island")
      .map((entity) => entity.y);
    expect(Math.max(...entityRows) - Math.min(...entityRows)).toBeLessThan(
      3 * gridGap,
    );
  });

  test("centers four siblings and keeps long relationship labels out of vertical spacing", () => {
    const entities = ["Hub", "A", "B", "C", "D"].map((name) => ({
      name,
      attributes: [{ name: `${name}_id`, type: "varchar(255)", keys: ["PK"] }],
    }));
    const makeDiagram = (label) => ({
      entities,
      relationships: entities.slice(1).map((entity) => ({
        from: "Hub",
        to: entity.name,
        fromCardinality: "one",
        toCardinality: "zero-or-more",
        identifying: false,
        label,
      })),
    });
    const shortLayout = layoutDiagram(makeDiagram("owns"));
    const wideLayout = layoutDiagram(
      makeDiagram("a_relationship_label_that_is_deliberately_very_wide"),
    );
    const centerRow = shortLayout.entities.find(
      (entity) => entity.name === "Hub",
    )?.y;
    const siblingRows = shortLayout.entities
      .filter((entity) => entity.name !== "Hub")
      .map((entity) => entity.y)
      .sort((left, right) => left - right);
    expect(centerRow).toBeDefined();
    expect(siblingRows).toHaveLength(4);
    if (centerRow === undefined) throw new Error("Expected hub row");
    expect(siblingRows[0]).toBeLessThan(centerRow);
    expect(siblingRows[3]).toBeGreaterThan(centerRow);
    expect((siblingRows[0] + siblingRows[3]) / 2).toBeCloseTo(centerRow);
    expect(siblingRows[1] - (siblingRows[0] ?? 0)).toBeCloseTo(
      siblingRows[2] - (siblingRows[1] ?? 0),
    );
    expect(siblingRows[2] - (siblingRows[1] ?? 0)).toBeCloseTo(
      siblingRows[3] - (siblingRows[2] ?? 0),
    );
    const rows = (layout) =>
      layout.entities
        .map((entity) => [entity.name, entity.y])
        .sort(([left], [right]) => left.localeCompare(right));
    expect(rows(wideLayout)).toEqual(rows(shortLayout));
    expect(wideLayout.bounds.width).toBeGreaterThan(shortLayout.bounds.width);
    expect(wideLayout.bounds.height).toBe(shortLayout.bounds.height);
  });

  test("keeps entity clusters disjoint for chain, cycle, and isolated nodes", () => {
    const entities = ["A", "B", "C", "D", "Solo"].map((name) => ({
      name,
      attributes: [
        { name: `${name}_id`, keys: ["PK"] },
        {
          name: `${name}_detail`,
          type: "a_very_long_varchar_type_that_sets_cluster_extent",
          keys: [],
        },
      ],
    }));
    const relationships = [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "A"],
    ].map(([from, to]) => ({
      from,
      to,
      fromCardinality: "one",
      toCardinality: "zero-or-more",
      identifying: false,
      label: "connected",
    }));
    const layout = layoutDiagram({ entities, relationships });
    expect(new Set(layout.entities.map(({ x }) => x)).size).toBeGreaterThan(1);
    expect(new Set(layout.entities.map(({ y }) => y)).size).toBeGreaterThan(1);
    expect(
      layout.relationships.some((relationship) =>
        relationship.links.some((link) => link.from.y !== link.to.y),
      ),
    ).toBe(true);
    const clusters = layout.entities.map((entity) => {
      const attached = layout.attributes.filter(
        (attribute) => attribute.entity === entity.name,
      );
      return [entity, ...attached];
    });
    for (const [index, cluster] of clusters.entries()) {
      for (const other of clusters.slice(index + 1)) {
        for (const left of cluster) {
          for (const right of other) {
            expect(
              left.x + left.width <= right.x ||
                right.x + right.width <= left.x ||
                left.y + left.height <= right.y ||
                right.y + right.height <= left.y,
            ).toBe(true);
          }
        }
      }
    }
    expect(
      layout.entities.find((entity) => entity.name === "Solo"),
    ).toBeDefined();
    expect(layout).toEqual(layoutDiagram({ entities, relationships }));
  });

  test("routes vertical and diagonal relationship links onto both shape boundaries", () => {
    const entities = ["A", "B", "C"].map((name) => ({ name, attributes: [] }));
    const relationships = [
      ["A", "B"],
      ["B", "C"],
    ].map(([from, to]) => ({
      from,
      to,
      fromCardinality: "one",
      toCardinality: "one",
      identifying: false,
      label: "joins",
    }));
    const layout = layoutDiagram({ entities, relationships });
    for (const [index, relationship] of layout.relationships.entries()) {
      const source = layout.entities.find(
        (entity) => entity.name === relationships[index]?.from,
      );
      const target = layout.entities.find(
        (entity) => entity.name === relationships[index]?.to,
      );
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      if (!source || !target)
        throw new Error("Expected relationship endpoints");
      const sourceCenter = {
        x: source.x + source.width / 2,
        y: source.y + source.height / 2,
      };
      const targetCenter = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      };
      for (const [point, center, shape] of [
        [relationship.links[0]?.from, sourceCenter, source],
        [relationship.links[1]?.to, targetCenter, target],
      ]) {
        if (!point) throw new Error("Expected entity boundary endpoint");
        expect(
          Math.max(
            Math.abs(point.x - center.x) / (shape.width / 2),
            Math.abs(point.y - center.y) / (shape.height / 2),
          ),
        ).toBeCloseTo(1);
      }
      for (const [point, endpoint] of [
        [relationship.links[0]?.to, sourceCenter],
        [relationship.links[1]?.from, targetCenter],
      ]) {
        if (!point || !endpoint)
          throw new Error("Expected diamond boundary endpoint");
        expect(
          Math.abs(point.x - relationship.center.x) / (relationship.width / 2) +
            Math.abs(point.y - relationship.center.y) /
              (relationship.height / 2),
        ).toBeCloseTo(1);
      }
    }
  });

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
