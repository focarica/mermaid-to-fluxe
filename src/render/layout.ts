import type { Diagram } from "../parser/model";

export type Point = { readonly x: number; readonly y: number };
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
export type EntityShape = Box & { readonly name: string };
export type AttributeShape = Box & {
  readonly entity: string;
  readonly name: string;
  readonly keys: readonly ("PK" | "FK" | "UK")[];
  readonly type?: string;
  readonly comment?: string;
  readonly anchor: Point;
};
export type RelationshipShape = {
  readonly label: string;
  readonly identifying: boolean;
  readonly center: Point;
  readonly width: number;
  readonly height: number;
  readonly links: readonly {
    readonly from: Point;
    readonly to: Point;
    readonly cardinality: string;
  }[];
};
export type DiagramLayout = {
  readonly bounds: Box;
  readonly entities: readonly EntityShape[];
  readonly attributes: readonly AttributeShape[];
  readonly relationships: readonly RelationshipShape[];
};

const padding = 48;
const entityHeight = 58;
export function layoutDiagram(diagram: Diagram): DiagramLayout {
  const clearance = 24;
  const entityWidths = diagram.entities.map((entity) =>
    Math.max(144, entity.name.length * 10 + 36),
  );
  const attributeWidths = diagram.entities.map((entity) =>
    Math.max(
      116,
      ...entity.attributes.map((attribute) => {
        const keyLabel =
          attribute.keys.length > 0 ? `  ${attribute.keys.join("/")}` : "";
        return Math.max(
          (attribute.name.length + keyLabel.length) * 9 + 36,
          (attribute.type?.length ?? 0) * 7 + 24,
        );
      }),
    ),
  );
  const attributeRadii = attributeWidths.map((width) =>
    Math.hypot(width / 2, 24),
  );
  const entityRadii = entityWidths.map((width) =>
    Math.hypot(width / 2, entityHeight / 2),
  );
  const selfRelationshipEntities = new Set(
    diagram.relationships
      .filter((relationship) => relationship.from === relationship.to)
      .map((relationship) => relationship.from),
  );
  const orbitRadii = diagram.entities.map((entity, index) => {
    const count = entity.attributes.length;
    if (count === 0) return 0;
    const attributeRadius = attributeRadii[index] ?? 0;
    const entityRadius = entityRadii[index] ?? 0;
    const entityClearance = entityRadius + attributeRadius + clearance;
    const angularGap = selfRelationshipEntities.has(entity.name)
      ? Math.PI / (count + 1)
      : (Math.PI * 2) / count;
    const attributeClearance =
      count === 1 && !selfRelationshipEntities.has(entity.name)
        ? 0
        : (2 * attributeRadius + clearance) / (2 * Math.sin(angularGap / 2));
    return Math.max(entityClearance, attributeClearance);
  });
  const groupExtent = Math.max(
    ...entityRadii,
    ...orbitRadii.map(
      (radius, index) => radius + (attributeRadii[index] ?? 0) + clearance + 12,
    ),
  );
  const widestRelationship = Math.max(
    112,
    ...diagram.relationships.map(
      (relationship) => relationship.label.length * 9 + 42,
    ),
  );
  const entityGap = groupExtent * 2 + widestRelationship + 96;
  const verticalGap = groupExtent * 2 + 72 + clearance * 2;
  const adjacency = new Map(
    diagram.entities.map((entity) => [entity.name, new Set<string>()]),
  );
  for (const relationship of diagram.relationships) {
    adjacency.get(relationship.from)?.add(relationship.to);
    adjacency.get(relationship.to)?.add(relationship.from);
  }
  const positions = new Map<
    string,
    { readonly column: number; readonly row: number }
  >();
  const entityOrder = new Map(
    diagram.entities.map((entity, index) => [entity.name, index]),
  );
  let componentOffset = 0;
  for (const entity of [...diagram.entities].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (positions.has(entity.name)) continue;
    const component = new Set<string>();
    const pending = [entity.name];
    while (pending.length > 0) {
      const name = pending.pop();
      if (!name || component.has(name)) continue;
      component.add(name);
      pending.push(...(adjacency.get(name) ?? []));
    }
    const root = [...component].sort((left, right) => {
      const degreeDifference =
        (adjacency.get(right)?.size ?? 0) - (adjacency.get(left)?.size ?? 0);
      return (
        degreeDifference ||
        left.localeCompare(right) ||
        (entityOrder.get(left) ?? 0) - (entityOrder.get(right) ?? 0)
      );
    })[0];
    if (!root) continue;
    const levels = new Map<string, number>([[root, 0]]);
    const queue = [root];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const nextLevel = (levels.get(current) ?? 0) + 1;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!component.has(neighbor) || levels.has(neighbor)) continue;
        levels.set(neighbor, nextLevel);
        queue.push(neighbor);
      }
    }
    const maximumLevel = Math.max(0, ...levels.values());
    const rows = new Map<string, number>([[root, 0]]);
    for (let level = 1; level <= maximumLevel; level += 1) {
      const layer = [...component].filter((name) => levels.get(name) === level);
      const parentRow = (name: string): number => {
        const parents = [...(adjacency.get(name) ?? [])].filter(
          (parent) => levels.get(parent) === level - 1,
        );
        return parents.length === 0
          ? 0
          : parents.reduce((sum, parent) => sum + (rows.get(parent) ?? 0), 0) /
              parents.length;
      };
      layer.sort(
        (left, right) =>
          parentRow(left) - parentRow(right) ||
          (entityOrder.get(left) ?? 0) - (entityOrder.get(right) ?? 0) ||
          left.localeCompare(right),
      );
      const parentCenter =
        layer.reduce((sum, name) => sum + parentRow(name), 0) / layer.length;
      const rowValues = layer.map(
        (name, index) => parentRow(name) + index - (layer.length - 1) / 2,
      );
      for (let index = 1; index < rowValues.length; index += 1) {
        const previous = rowValues[index - 1] ?? 0;
        const current = rowValues[index] ?? previous + 1;
        rowValues[index] = Math.max(current, previous + 1);
      }
      const rowCenter =
        rowValues.reduce((sum, row) => sum + row, 0) / rowValues.length;
      layer.forEach((name, row) => {
        rows.set(name, (rowValues[row] ?? row) + parentCenter - rowCenter);
      });
    }
    for (const name of component) {
      positions.set(name, {
        column: componentOffset + (levels.get(name) ?? 0),
        row: rows.get(name) ?? 0,
      });
    }
    componentOffset += maximumLevel + 2;
  }
  const entities = diagram.entities.map((entity, index) => ({
    name: entity.name,
    x: padding + (positions.get(entity.name)?.column ?? index) * entityGap,
    y: padding + (positions.get(entity.name)?.row ?? 0) * verticalGap,
    width: entityWidths[index] ?? 144,
    height: entityHeight,
  }));
  const findEntity = (name: string): EntityShape =>
    entities.find((entity) => entity.name === name) ?? {
      name,
      x: padding,
      y: padding,
      width: 144,
      height: entityHeight,
    };
  const attributes: AttributeShape[] = [];
  for (const [entityIndex, entity] of diagram.entities.entries()) {
    const shape = findEntity(entity.name);
    entity.attributes.forEach((attribute, index) => {
      const angle = selfRelationshipEntities.has(entity.name)
        ? Math.PI / (entity.attributes.length + 1) +
          (index * Math.PI) / (entity.attributes.length + 1)
        : -Math.PI / 2 +
          (index * Math.PI * 2) / Math.max(entity.attributes.length, 1);
      const keyLabel =
        attribute.keys.length > 0 ? `  ${attribute.keys.join("/")}` : "";
      const width = Math.max(
        116,
        (attribute.name.length + keyLabel.length) * 9 + 36,
        (attribute.type?.length ?? 0) * 7 + 24,
      );
      const height = 48;
      const anchor = {
        x: shape.x + shape.width / 2,
        y: shape.y + shape.height / 2,
      };
      const radius = orbitRadii[entityIndex] ?? 0;
      attributes.push({
        entity: entity.name,
        name: attribute.name,
        keys: attribute.keys,
        ...(attribute.type === undefined ? {} : { type: attribute.type }),
        ...(attribute.comment === undefined
          ? {}
          : { comment: attribute.comment }),
        anchor,
        x: anchor.x + Math.cos(angle) * radius - width / 2,
        y: anchor.y + Math.sin(angle) * radius - height / 2,
        width,
        height,
      });
    });
  }
  const relationships = diagram.relationships.map((relationship) => {
    const fromEntity = findEntity(relationship.from);
    const toEntity = findEntity(relationship.to);
    const from = {
      x: fromEntity.x + fromEntity.width / 2,
      y: fromEntity.y + fromEntity.height / 2,
    };
    const to = {
      x: toEntity.x + toEntity.width / 2,
      y: toEntity.y + toEntity.height / 2,
    };
    const width = Math.max(112, relationship.label.length * 9 + 42);
    const height = 72;
    const isSelfRelationship = relationship.from === relationship.to;
    const center = isSelfRelationship
      ? {
          x: from.x,
          y: from.y - fromEntity.height / 2 - height / 2 - clearance,
        }
      : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const boundaryPoint = (
      origin: Point,
      toward: Point,
      box: EntityShape,
    ): Point => {
      const dx = toward.x - origin.x;
      const dy = toward.y - origin.y;
      const scale = Math.max(
        Math.abs(dx) / (box.width / 2),
        Math.abs(dy) / (box.height / 2),
      );
      return { x: origin.x + dx / scale, y: origin.y + dy / scale };
    };
    const diamondPoint = (toward: Point): Point => {
      const dx = toward.x - center.x;
      const dy = toward.y - center.y;
      const scale = Math.abs(dx) / (width / 2) + Math.abs(dy) / (height / 2);
      return { x: center.x + dx / scale, y: center.y + dy / scale };
    };
    const links = isSelfRelationship
      ? [
          {
            from: {
              x: from.x - Math.min(fromEntity.width / 4, 24),
              y: from.y - fromEntity.height / 2,
            },
            to: {
              x: center.x - width / 4,
              y: center.y + height / 4,
            },
            cardinality: relationship.fromCardinality,
          },
          {
            from: {
              x: center.x + width / 4,
              y: center.y + height / 4,
            },
            to: {
              x: to.x + toEntity.width / 4,
              y: to.y - toEntity.height / 2,
            },
            cardinality: relationship.toCardinality,
          },
        ]
      : [
          {
            from: boundaryPoint(from, center, fromEntity),
            to: diamondPoint(from),
            cardinality: relationship.fromCardinality,
          },
          {
            from: diamondPoint(to),
            to: boundaryPoint(to, center, toEntity),
            cardinality: relationship.toCardinality,
          },
        ];
    return {
      label: relationship.label,
      identifying: relationship.identifying,
      center,
      width,
      height,
      links,
    };
  });
  const extents = [
    ...entities,
    ...attributes.map(({ x, y, width, height, type }) => ({
      x,
      y,
      width,
      height: height + (type ? 24 : 0),
    })),
    ...relationships.map(({ center, width, height }) => ({
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    })),
  ];
  const minX = Math.min(0, ...extents.map((item) => item.x - padding));
  const minY = Math.min(0, ...extents.map((item) => item.y - padding));
  const maxX = Math.max(
    1,
    ...extents.map((item) => item.x + item.width + padding),
  );
  const maxY = Math.max(
    1,
    ...extents.map((item) => item.y + item.height + padding),
  );
  return {
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    entities,
    attributes,
    relationships,
  };
}
