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
  test("packs disconnected entities without an unused component column", () => {
    const layout = layoutDiagram({
      entities: ["First", "Second", "Third"].map((name) => ({
        name,
        attributes: [],
      })),
      relationships: [],
    });
    const positions = layout.entities.map(({ x }) => x).sort((a, b) => a - b);
    expect(positions[1] - (positions[0] ?? 0)).toBeLessThan(500);
    expect(positions[2] - (positions[1] ?? 0)).toBeLessThan(500);
  });

  test("centers the most connected entity and spreads its neighbors in 2D", () => {
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
    const leaves = [leafB, byName.get("Leaf C")];
    expect(leaves.every((entity) => entity !== undefined)).toBe(true);
    const leafRows = leaves.map((entity) => entity?.y ?? root.y);
    expect(Math.min(...leafRows)).toBeLessThan(root.y);
    expect(Math.max(...leafRows)).toBeGreaterThan(root.y);
    const component = layout.entities.filter(
      (entity) => entity.name !== "Island",
    );
    const centersX = component.map((entity) => entity.x + entity.width / 2);
    const centersY = component.map((entity) => entity.y + entity.height / 2);
    expect(root.x + root.width / 2).toBeGreaterThan(Math.min(...centersX));
    expect(root.x + root.width / 2).toBeLessThan(Math.max(...centersX));
    expect(root.y + root.height / 2).toBeGreaterThan(Math.min(...centersY));
    expect(root.y + root.height / 2).toBeLessThan(Math.max(...centersY));
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
  });

  test("centers a hub among four spokes and accommodates long relationship labels", () => {
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
    const hub = shortLayout.entities.find((entity) => entity.name === "Hub");
    expect(hub).toBeDefined();
    if (!hub) throw new Error("Expected hub entity");
    const spokes = shortLayout.entities.filter(
      (entity) => entity.name !== "Hub",
    );
    expect(spokes).toHaveLength(4);
    expect(
      Math.min(...spokes.map((entity) => entity.x + entity.width / 2)),
    ).toBeLessThan(hub.x + hub.width / 2);
    expect(
      Math.max(...spokes.map((entity) => entity.x + entity.width / 2)),
    ).toBeGreaterThan(hub.x + hub.width / 2);
    expect(
      Math.min(...spokes.map((entity) => entity.y + entity.height / 2)),
    ).toBeLessThan(hub.y + hub.height / 2);
    expect(
      Math.max(...spokes.map((entity) => entity.y + entity.height / 2)),
    ).toBeGreaterThan(hub.y + hub.height / 2);
    expect(wideLayout.bounds.width).toBeGreaterThan(shortLayout.bounds.width);
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

  test("marks weak entities and identifying relationships from composite keys", () => {
    const weakDiagram = {
      entities: [
        { name: "Owner", attributes: [{ name: "owner_id", keys: ["PK"] }] },
        {
          name: "Dependent",
          attributes: [
            { name: "owner_id", keys: ["PK", "FK"] },
            { name: "dependent_name", type: "TEXT[]", keys: ["PK"] },
          ],
        },
        { name: "Strong", attributes: [{ name: "strong_id", keys: ["PK"] }] },
      ],
      relationships: [
        {
          from: "Owner",
          to: "Dependent",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: true,
          label: "identifies",
        },
        {
          from: "Owner",
          to: "Strong",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: true,
          label: "relates",
        },
      ],
    };
    const layout = layoutDiagram(weakDiagram);
    expect(layout.entities.find(({ name }) => name === "Owner")?.weak).toBe(
      false,
    );
    expect(layout.entities.find(({ name }) => name === "Dependent")?.weak).toBe(
      true,
    );
    expect(layout.relationships[0]?.identifying).toBe(true);
    expect(layout.relationships[1]?.identifying).toBe(false);
    expect(layout.relationships[0]?.links[1]?.doubleLine).toBe(true);
    const partialKey = layout.attributes.find(
      ({ name }) => name === "dependent_name",
    );
    expect(partialKey?.multivalued).toBe(true);
    expect(partialKey?.partialKey).toBe(true);
  });

  test("keeps force placement deterministic for complex hub components", () => {
    const crowded = {
      entities: [
        {
          name: "Detailed",
          attributes: Array.from({ length: 12 }, (_, index) => ({
            name: `field_${index}`,
            keys: [],
          })),
        },
        { name: "Middle", attributes: [] },
        { name: "Tail", attributes: [] },
        { name: "Extra A", attributes: [] },
        { name: "Extra B", attributes: [] },
      ],
      relationships: [
        {
          from: "Detailed",
          to: "Middle",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: false,
          label: "contains",
        },
        {
          from: "Middle",
          to: "Tail",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: false,
          label: "continues",
        },
        {
          from: "Detailed",
          to: "Extra A",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: false,
          label: "contains",
        },
        {
          from: "Detailed",
          to: "Extra B",
          fromCardinality: "one",
          toCardinality: "zero-or-more",
          identifying: false,
          label: "contains",
        },
      ],
    };
    const layout = layoutDiagram(crowded);
    const detailed = layout.entities.find(({ name }) => name === "Detailed");
    const middle = layout.entities.find(({ name }) => name === "Middle");
    const tail = layout.entities.find(({ name }) => name === "Tail");
    expect(detailed).toBeDefined();
    expect(middle).toBeDefined();
    expect(tail).toBeDefined();
    if (!detailed || !middle || !tail) throw new Error("Expected chain nodes");
    expect(layout).toEqual(layoutDiagram(crowded));
  });

  test("applies named position offsets to entity clusters and recomputes links", () => {
    const base = layoutDiagram(diagram);
    const moved = layoutDiagram(
      diagram,
      new Map([["Customer", { x: 120, y: 75 }]]),
    );
    const customer = base.entities.find(({ name }) => name === "Customer");
    const movedCustomer = moved.entities.find(
      ({ name }) => name === "Customer",
    );
    const attribute = base.attributes.find(
      ({ entity }) => entity === "Customer",
    );
    const movedAttribute = moved.attributes.find(
      ({ entity }) => entity === "Customer",
    );
    expect(customer).toBeDefined();
    expect(movedCustomer).toBeDefined();
    expect(attribute).toBeDefined();
    expect(movedAttribute).toBeDefined();
    if (!customer || !movedCustomer || !attribute || !movedAttribute)
      throw new Error("Expected moved cluster");
    expect(movedCustomer.x - customer.x).toBe(120);
    expect(movedCustomer.y - customer.y).toBe(75);
    expect(movedAttribute.x - attribute.x).toBeCloseTo(120);
    expect(movedAttribute.y - attribute.y).toBeCloseTo(75);
    expect(movedAttribute.anchor.x - attribute.anchor.x).toBe(120);
    expect(movedAttribute.anchor.y - attribute.anchor.y).toBe(75);
    expect(moved.relationships[0]?.links).not.toEqual(
      base.relationships[0]?.links,
    );
    expect(moved.relationships[0]?.center).not.toEqual(
      base.relationships[0]?.center,
    );
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
    const centerDistance = Math.hypot(
      first.x + first.width / 2 - second.x - second.width / 2,
      first.y + first.height / 2 - second.y - second.height / 2,
    );
    expect(centerDistance).toBeGreaterThan(
      Math.max(first.width, first.height, second.width, second.height),
    );
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
