import type { Diagram } from "../parser/model";

export type Point = { readonly x: number; readonly y: number };
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
export type EntityShape = Box & {
  readonly name: string;
  readonly weak: boolean;
};
export type AttributeShape = Box & {
  readonly entity: string;
  readonly name: string;
  readonly positionKey: string;
  readonly parent?: string;
  readonly keys: readonly ("PK" | "FK" | "UK")[];
  readonly multivalued: boolean;
  readonly partialKey: boolean;
  readonly derived: boolean;
  readonly composite: boolean;
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
    readonly doubleLine: boolean;
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
export function layoutDiagram(
  diagram: Diagram,
  positionOffsets: ReadonlyMap<string, Point> = new Map(),
): DiagramLayout {
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
          ...(attribute.components ?? []).map((name) => name.length * 9 + 36),
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
  const weakEntities = new Set(
    diagram.entities
      .filter((entity) =>
        entity.attributes.some(
          (attribute) =>
            attribute.keys.includes("PK") && attribute.keys.includes("FK"),
        ),
      )
      .map((entity) => entity.name),
  );
  const orbitRadii = diagram.entities.map((entity, index) => {
    const count = entity.attributes.reduce(
      (total, attribute) => total + 1 + (attribute.components?.length ?? 0),
      0,
    );
    if (count === 0) return 0;
    const attributeRadius = attributeRadii[index] ?? 0;
    const entityRadius = entityRadii[index] ?? 0;
    const entityClearance = entityRadius + attributeRadius + clearance;
    const incident = diagram.relationships.filter(
      (relationship) =>
        relationship.from === entity.name || relationship.to === entity.name,
    );
    const incidentAngles = incident.map((relationship) =>
      relationship.from === entity.name ? 0 : Math.PI,
    );
    const angularGap = selfRelationshipEntities.has(entity.name)
      ? Math.PI / (count + 1)
      : (Math.PI * 2) / count;
    const attributeClearance =
      count === 1 && !selfRelationshipEntities.has(entity.name)
        ? 0
        : (2 * attributeRadius + clearance) / (2 * Math.sin(angularGap / 2));
    const angleCandidates = Array.from(
      { length: Math.max(count, 1) },
      (_, slot) => -Math.PI / 2 + (slot * Math.PI * 2) / Math.max(count, 1),
    );
    const directionClearance =
      incidentAngles.length === 0
        ? 0
        : Math.max(
              ...angleCandidates.map((angle) =>
                Math.min(
                  ...incidentAngles.map((incidentAngle) =>
                    Math.abs(
                      Math.atan2(
                        Math.sin(angle - incidentAngle),
                        Math.cos(angle - incidentAngle),
                      ),
                    ),
                  ),
                ),
              ),
            ) <
            Math.PI / 3
          ? entityClearance + attributeRadius
          : 0;
    return Math.max(entityClearance, attributeClearance, directionClearance);
  });
  const adjacency = new Map(
    diagram.entities.map((entity) => [entity.name, new Set<string>()]),
  );
  for (const relationship of diagram.relationships) {
    adjacency.get(relationship.from)?.add(relationship.to);
    adjacency.get(relationship.to)?.add(relationship.from);
  }
  const relationshipDegree = new Map(
    diagram.entities.map((entity) => [entity.name, 0]),
  );
  for (const relationship of diagram.relationships) {
    relationshipDegree.set(
      relationship.from,
      (relationshipDegree.get(relationship.from) ?? 0) + 1,
    );
    relationshipDegree.set(
      relationship.to,
      (relationshipDegree.get(relationship.to) ?? 0) + 1,
    );
  }
  const cloudExtents = new Map(
    diagram.entities.map((entity, index) => [
      entity.name,
      Math.max(
        entityRadii[index] ?? 0,
        (orbitRadii[index] ?? 0) +
          (attributeRadii[index] ?? 0) +
          Math.max(
            0,
            ...entity.attributes.flatMap((attribute) =>
              (attribute.components ?? []).map(
                (name) => (name.length * 9 + 36) / 2 + 28,
              ),
            ),
          ) +
          clearance +
          12,
      ),
    ]),
  );
  const positions = new Map<string, Point>();
  const positioned = new Set<string>();
  let componentOffset = padding;
  for (const entity of [...diagram.entities].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (positioned.has(entity.name)) continue;
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
        (relationshipDegree.get(right) ?? 0) -
        (relationshipDegree.get(left) ?? 0);
      return degreeDifference || left.localeCompare(right);
    })[0];
    if (!root) continue;
    const members = [...component].sort((left, right) =>
      left.localeCompare(right),
    );
    const leaves = members.filter(
      (name) => name !== root && (relationshipDegree.get(name) ?? 0) <= 1,
    );
    const core = members.filter(
      (name) => name !== root && (relationshipDegree.get(name) ?? 0) > 1,
    );
    const localPositions = new Map<string, { x: number; y: number }>([
      [root, { x: 0, y: 0 }],
    ]);
    const placeOnRing = (names: string[], ringOffset: number): void => {
      if (names.length === 0) return;
      const maxExtent = Math.max(
        ...names.map((name) => cloudExtents.get(name) ?? 0),
      );
      const radius =
        (cloudExtents.get(root) ?? 0) + maxExtent + ringOffset + 112;
      names.forEach((name, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / names.length;
        localPositions.set(name, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });
    };
    placeOnRing(core, 64);
    placeOnRing(leaves, 176);
    const initialPositions = new Map(
      [...localPositions].map(([name, point]) => [name, { ...point }]),
    );
    const links = diagram.relationships.filter(
      (relationship) =>
        component.has(relationship.from) && component.has(relationship.to),
    );
    const forces = new Map<string, { x: number; y: number }>();
    const iterations = 180;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      forces.clear();
      for (const name of members) forces.set(name, { x: 0, y: 0 });
      for (let leftIndex = 0; leftIndex < members.length; leftIndex += 1) {
        const leftName = members[leftIndex];
        const left = leftName ? localPositions.get(leftName) : undefined;
        if (!leftName || !left) continue;
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < members.length;
          rightIndex += 1
        ) {
          const rightName = members[rightIndex];
          const right = rightName ? localPositions.get(rightName) : undefined;
          if (!rightName || !right) continue;
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 0.01) {
            dx = leftIndex + 1;
            dy = rightIndex + 1;
            distance = Math.hypot(dx, dy);
          }
          const minDistance =
            (cloudExtents.get(leftName) ?? 0) +
            (cloudExtents.get(rightName) ?? 0) +
            32;
          const repulsion =
            (minDistance * minDistance * 0.035) / (distance * distance) +
            Math.max(0, minDistance - distance) * 0.12;
          const leftForce = forces.get(leftName);
          const rightForce = forces.get(rightName);
          if (!leftForce || !rightForce) continue;
          leftForce.x -= (dx / distance) * repulsion;
          leftForce.y -= (dy / distance) * repulsion;
          rightForce.x += (dx / distance) * repulsion;
          rightForce.y += (dy / distance) * repulsion;
        }
      }
      for (const relationship of links) {
        if (relationship.from === relationship.to) continue;
        const from = localPositions.get(relationship.from);
        const to = localPositions.get(relationship.to);
        const fromForce = forces.get(relationship.from);
        const toForce = forces.get(relationship.to);
        if (!from || !to || !fromForce || !toForce) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy) || 1;
        const targetDistance =
          (cloudExtents.get(relationship.from) ?? 0) +
          (cloudExtents.get(relationship.to) ?? 0) +
          Math.max(112, relationship.label.length * 9 + 42) +
          48;
        const spring = Math.max(
          -18,
          Math.min(18, (distance - targetDistance) * 0.018),
        );
        fromForce.x += (dx / distance) * spring;
        fromForce.y += (dy / distance) * spring;
        toForce.x -= (dx / distance) * spring;
        toForce.y -= (dy / distance) * spring;
        for (const name of members) {
          if (name === relationship.from || name === relationship.to) continue;
          const obstacle = localPositions.get(name);
          const obstacleForce = forces.get(name);
          if (!obstacle || !obstacleForce) continue;
          const projection = Math.max(
            0,
            Math.min(
              1,
              ((obstacle.x - from.x) * dx + (obstacle.y - from.y) * dy) /
                (distance * distance),
            ),
          );
          const nearest = {
            x: from.x + dx * projection,
            y: from.y + dy * projection,
          };
          const awayX = obstacle.x - nearest.x;
          const awayY = obstacle.y - nearest.y;
          const clearanceDistance =
            (cloudExtents.get(name) ?? 0) +
            Math.max(112, relationship.label.length * 9 + 42) / 2 +
            24;
          const obstacleDistance = Math.hypot(awayX, awayY);
          if (obstacleDistance >= clearanceDistance) continue;
          const direction =
            obstacleDistance > 0.01
              ? { x: awayX / obstacleDistance, y: awayY / obstacleDistance }
              : { x: 0, y: 1 };
          const avoidance = (clearanceDistance - obstacleDistance) * 0.06;
          obstacleForce.x += direction.x * avoidance;
          obstacleForce.y += direction.y * avoidance;
          if (name === root) {
            fromForce.x -= direction.x * avoidance * 0.5;
            fromForce.y -= direction.y * avoidance * 0.5;
            toForce.x -= direction.x * avoidance * 0.5;
            toForce.y -= direction.y * avoidance * 0.5;
          }
        }
      }
      const cooling = 1 - (iteration / iterations) * 0.65;
      for (const name of members) {
        if (name === root) continue;
        const position = localPositions.get(name);
        const initial = initialPositions.get(name);
        const force = forces.get(name);
        if (!position || !initial || !force) continue;
        force.x += (initial.x - position.x) * 0.0015 - position.x * 0.0007;
        force.y += (initial.y - position.y) * 0.0015 - position.y * 0.0007;
        const magnitude = Math.hypot(force.x, force.y) || 1;
        const step = Math.min(24, magnitude) * cooling;
        localPositions.set(name, {
          x: position.x + (force.x / magnitude) * step,
          y: position.y + (force.y / magnitude) * step,
        });
      }
    }
    const halfWidth = Math.max(
      ...members.map(
        (name) =>
          Math.abs(localPositions.get(name)?.x ?? 0) +
          (cloudExtents.get(name) ?? 0),
      ),
    );
    const halfHeight = Math.max(
      ...members.map(
        (name) =>
          Math.abs(localPositions.get(name)?.y ?? 0) +
          (cloudExtents.get(name) ?? 0),
      ),
    );
    for (const name of members) {
      const position = localPositions.get(name);
      if (!position) continue;
      positions.set(name, {
        x: componentOffset + halfWidth + position.x,
        y: padding + halfHeight + position.y,
      });
      positioned.add(name);
    }
    componentOffset += halfWidth * 2 + 112;
  }
  const entities = diagram.entities.map((entity, index) => ({
    name: entity.name,
    weak: weakEntities.has(entity.name),
    x:
      (positions.get(entity.name)?.x ?? padding + index * 200) -
      (entityWidths[index] ?? 144) / 2 +
      (positionOffsets.get(entity.name)?.x ?? 0),
    y:
      (positions.get(entity.name)?.y ?? padding) -
      entityHeight / 2 +
      (positionOffsets.get(entity.name)?.y ?? 0),
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
      weak: false,
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
      const height = attribute.type ? 64 : 48;
      const center = {
        x: shape.x + shape.width / 2,
        y: shape.y + shape.height / 2,
      };
      const radius = orbitRadii[entityIndex] ?? 0;
      const offset = positionOffsets.get(
        `attribute:${entity.name}:${attribute.name}`,
      );
      const x =
        center.x + Math.cos(angle) * radius - width / 2 + (offset?.x ?? 0);
      const y =
        center.y + Math.sin(angle) * radius - height / 2 + (offset?.y ?? 0);
      const attributeCenter = { x: x + width / 2, y: y + height / 2 };
      const boundary = (origin: Point, toward: Point, box: Box): Point => {
        const dx = toward.x - origin.x;
        const dy = toward.y - origin.y;
        const scale = Math.max(
          Math.abs(dx) / (box.width / 2),
          Math.abs(dy) / (box.height / 2),
        );
        return { x: origin.x + dx / scale, y: origin.y + dy / scale };
      };
      const entityBoundary = boundary(center, attributeCenter, shape);
      attributes.push({
        entity: entity.name,
        name: attribute.name,
        positionKey: `attribute:${entity.name}:${attribute.name}`,
        keys: attribute.keys,
        multivalued: attribute.type?.endsWith("[]") ?? false,
        partialKey:
          weakEntities.has(entity.name) &&
          attribute.keys.includes("PK") &&
          !attribute.keys.includes("FK"),
        derived: attribute.derived ?? false,
        composite: (attribute.components?.length ?? 0) > 0,
        ...(attribute.type === undefined ? {} : { type: attribute.type }),
        ...(attribute.comment === undefined
          ? {}
          : { comment: attribute.comment }),
        anchor: entityBoundary,
        x,
        y,
        width,
        height,
      });
      const components = attribute.components ?? [];
      if (components.length > 0) {
        const radialLength =
          Math.hypot(
            attributeCenter.x - center.x,
            attributeCenter.y - center.y,
          ) || 1;
        const radial = {
          x: (attributeCenter.x - center.x) / radialLength,
          y: (attributeCenter.y - center.y) / radialLength,
        };
        const tangent = { x: -radial.y, y: radial.x };
        components.forEach((componentName, componentIndex) => {
          const componentWidth = Math.max(116, componentName.length * 9 + 36);
          const spread = (componentIndex - (components.length - 1) / 2) * 42;
          const componentCenter = {
            x:
              attributeCenter.x +
              radial.x * (width / 2 + componentWidth / 2 + 28) +
              tangent.x * spread,
            y:
              attributeCenter.y +
              radial.y * (width / 2 + componentWidth / 2 + 28) +
              tangent.y * spread,
          };
          const componentOffsetKey = `attribute:${entity.name}:${attribute.name}.${componentName}`;
          const componentOffset = positionOffsets.get(componentOffsetKey);
          const childCenter = {
            x: componentCenter.x + (componentOffset?.x ?? 0),
            y: componentCenter.y + (componentOffset?.y ?? 0),
          };
          const dx = childCenter.x - attributeCenter.x;
          const dy = childCenter.y - attributeCenter.y;
          const scale = 1 / Math.hypot(dx / (width / 2), dy / (height / 2));
          attributes.push({
            entity: entity.name,
            name: componentName,
            positionKey: componentOffsetKey,
            keys: [],
            multivalued: false,
            partialKey: false,
            derived: false,
            composite: false,
            parent: attribute.name,
            anchor: {
              x: attributeCenter.x + dx * scale,
              y: attributeCenter.y + dy * scale,
            },
            x: childCenter.x - componentWidth / 2,
            y: childCenter.y - 24,
            width: componentWidth,
            height: 48,
          });
        });
      }
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
    const defaultCenter = isSelfRelationship
      ? {
          x: from.x,
          y: from.y - fromEntity.height / 2 - height / 2 - clearance,
        }
      : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const relationshipIndex = diagram.relationships.indexOf(relationship);
    const relationshipOffset = positionOffsets.get(
      `relationship:${relationshipIndex}`,
    );
    const center = {
      x: defaultCenter.x + (relationshipOffset?.x ?? 0),
      y: defaultCenter.y + (relationshipOffset?.y ?? 0),
    };
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
            doubleLine:
              relationship.toCardinality === "one" ||
              relationship.toCardinality === "one-or-more",
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
            doubleLine:
              relationship.fromCardinality === "one" ||
              relationship.fromCardinality === "one-or-more",
          },
        ]
      : [
          {
            from: boundaryPoint(from, center, fromEntity),
            to: diamondPoint(from),
            cardinality: relationship.fromCardinality,
            doubleLine:
              relationship.toCardinality === "one" ||
              relationship.toCardinality === "one-or-more",
          },
          {
            from: diamondPoint(to),
            to: boundaryPoint(to, center, toEntity),
            cardinality: relationship.toCardinality,
            doubleLine:
              relationship.fromCardinality === "one" ||
              relationship.fromCardinality === "one-or-more",
          },
        ];
    return {
      label: relationship.label,
      identifying:
        relationship.identifying &&
        (weakEntities.has(relationship.from) ||
          weakEntities.has(relationship.to)),
      center,
      width,
      height,
      links,
    };
  });
  relationships.forEach((relationshipShape, index) => {
    const relationship = diagram.relationships[index];
    for (const [attributeIndex, attribute] of (
      relationship?.attributes ?? []
    ).entries()) {
      const width = Math.max(116, attribute.name.length * 9 + 36);
      const height = attribute.type ? 64 : 48;
      const spread =
        (attributeIndex - ((relationship?.attributes?.length ?? 1) - 1) / 2) *
        52;
      const xCenter = relationshipShape.center.x + spread;
      const yCenter =
        relationshipShape.center.y +
        relationshipShape.height / 2 +
        height / 2 +
        36;
      const offsetKey = `relationship-attribute:${index}:${attribute.name}`;
      const offset = positionOffsets.get(offsetKey);
      const center = {
        x: xCenter + (offset?.x ?? 0),
        y: yCenter + (offset?.y ?? 0),
      };
      const dx = center.x - relationshipShape.center.x;
      const dy = center.y - relationshipShape.center.y;
      const scale =
        1 /
        (Math.abs(dx) / (relationshipShape.width / 2) +
          Math.abs(dy) / (relationshipShape.height / 2));
      attributes.push({
        entity: `relationship:${index}`,
        name: attribute.name,
        positionKey: offsetKey,
        keys: attribute.keys,
        multivalued: attribute.type?.endsWith("[]") ?? false,
        partialKey: false,
        derived: attribute.derived ?? false,
        composite: (attribute.components?.length ?? 0) > 0,
        ...(attribute.type === undefined ? {} : { type: attribute.type }),
        ...(attribute.comment === undefined
          ? {}
          : { comment: attribute.comment }),
        anchor: {
          x: relationshipShape.center.x + dx * scale,
          y: relationshipShape.center.y + dy * scale,
        },
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
      });
    }
  });
  const extents = [
    ...entities,
    ...attributes.map(({ x, y, width, height }) => ({
      x,
      y,
      width,
      height,
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
