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
  const widestEntity = Math.max(
    144,
    ...diagram.entities.map((entity) => entity.name.length * 10 + 36),
  );
  const entityGap = widestEntity + 220;
  const entities = diagram.entities.map((entity, index) => ({
    name: entity.name,
    x: padding + index * entityGap,
    y: padding + (index % 2) * 42,
    width: Math.max(144, entity.name.length * 10 + 36),
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
  for (const entity of diagram.entities) {
    const shape = findEntity(entity.name);
    entity.attributes.forEach((attribute, index) => {
      const angle =
        -Math.PI / 2 +
        (index * Math.PI * 2) / Math.max(entity.attributes.length, 1);
      const keyLabel =
        attribute.keys.length > 0 ? `  ${attribute.keys.join("/")}` : "";
      const width = Math.max(
        116,
        (attribute.name.length + keyLabel.length) * 9 + 36,
      );
      const height = 48;
      const anchor = {
        x: shape.x + shape.width / 2,
        y: shape.y + shape.height / 2,
      };
      const radius =
        Math.max(shape.width, shape.height) / 2 +
        78 +
        Math.max(0, entity.attributes.length - 4) * 12;
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
    const center = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const width = Math.max(112, relationship.label.length * 9 + 42);
    return {
      label: relationship.label,
      identifying: relationship.identifying,
      center,
      width,
      height: 72,
      links: [
        {
          from: { x: from.x + fromEntity.width / 2, y: from.y },
          to: { x: center.x - width / 2, y: center.y },
          cardinality: relationship.fromCardinality,
        },
        {
          from: { x: center.x + width / 2, y: center.y },
          to: { x: to.x - toEntity.width / 2, y: to.y },
          cardinality: relationship.toCardinality,
        },
      ],
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
