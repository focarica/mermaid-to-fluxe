import rough from "roughjs";
import type { Diagram } from "../parser/model";
import type { Point } from "./layout";
import { layoutDiagram } from "./layout";

const ink = "#292a27";
const paper = "#fffdf7";
const muted = "#696a63";
const cardinalityText: Readonly<Record<string, string>> = {
  one: "1",
  "zero-or-one": "0..1",
  "one-or-more": "1..*",
  "zero-or-more": "0..*",
};

export function describeDiagram(diagram: Diagram): string {
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
  const entityDescriptions = diagram.entities.map((entity) => {
    const attributes = entity.attributes.map((attribute) => {
      const type = attribute.type ? `, type ${attribute.type}` : "";
      const keys = attribute.keys.length
        ? `, ${attribute.keys.join(", ")}`
        : "";
      const form = attribute.derived
        ? ", derived"
        : attribute.components?.length
          ? `, composite of ${attribute.components.join(", ")}`
          : "";
      const comment = attribute.comment ? `, comment ${attribute.comment}` : "";
      return `${attribute.name}${type}${keys}${form}${comment}`;
    });
    return `${entity.name}: ${attributes.join("; ") || "no attributes"}`;
  });
  const relationshipDescriptions = diagram.relationships.map(
    (relationship) =>
      `${relationship.from} (${cardinalityText[relationship.fromCardinality] ?? relationship.fromCardinality}) ${relationship.identifying && (weakEntities.has(relationship.from) || weakEntities.has(relationship.to)) ? "identifying" : "non-identifying"} relationship “${relationship.label}”${relationship.attributes?.length ? ` with attributes ${relationship.attributes.map(({ name }) => name).join(", ")}` : ""} to ${relationship.to} (${cardinalityText[relationship.toCardinality] ?? relationship.toCardinality})`,
  );
  return `Entities: ${entityDescriptions.join(". ") || "none"}. Relationships: ${relationshipDescriptions.join(". ") || "none"}.`;
}

export function renderDiagram(
  diagram: Diagram,
  document: Document = window.document,
  positionOffsets: ReadonlyMap<string, Point> = new Map(),
): SVGSVGElement {
  const layout = layoutDiagram(diagram, positionOffsets);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute(
    "viewBox",
    `${layout.bounds.x} ${layout.bounds.y} ${layout.bounds.width} ${layout.bounds.height}`,
  );
  svg.setAttribute("width", String(layout.bounds.width));
  svg.setAttribute("height", String(layout.bounds.height));
  svg.style.width = `${layout.bounds.width}px`;
  svg.style.backgroundColor = paper;
  svg.setAttribute("role", "img");
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.id = "diagram-svg-title";
  title.textContent = "Entity relationship diagram";
  const description = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "desc",
  );
  description.id = "diagram-svg-description";
  description.textContent = describeDiagram(diagram);
  svg.setAttribute("aria-labelledby", title.id);
  svg.setAttribute("aria-describedby", description.id);
  svg.append(title, description);
  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  background.setAttribute("x", String(layout.bounds.x));
  background.setAttribute("y", String(layout.bounds.y));
  background.setAttribute("width", String(layout.bounds.width));
  background.setAttribute("height", String(layout.bounds.height));
  background.setAttribute("fill", paper);
  svg.append(background);
  const roughSvg = rough.svg(svg);
  const addLabel = (
    text: string,
    x: number,
    y: number,
    size = 16,
    color = ink,
  ): SVGTextElement => {
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    label.textContent = text;
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("font-family", "ui-sans-serif, system-ui, sans-serif");
    label.setAttribute("font-size", String(size));
    label.setAttribute("font-weight", "550");
    label.setAttribute("fill", color);
    svg.append(label);
    return label;
  };
  const addConnector = (
    from: Point,
    to: Point,
    strokeWidth: number,
  ): SVGLineElement => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("stroke", ink);
    line.setAttribute("stroke-width", String(strokeWidth));
    line.setAttribute("stroke-linecap", "round");
    return line;
  };
  const addParallelConnector = (
    from: Point,
    to: Point,
    strokeWidth: number,
    separation: number,
  ): SVGLineElement => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = {
      x: (-dy / length) * separation,
      y: (dx / length) * separation,
    };
    return addConnector(
      { x: from.x + offset.x, y: from.y + offset.y },
      { x: to.x + offset.x, y: to.y + offset.y },
      strokeWidth,
    );
  };
  layout.attributes.forEach((attribute) => {
    const centerX = attribute.x + attribute.width / 2;
    const centerY = attribute.y + attribute.height / 2;
    const ellipseScale =
      1 /
      Math.hypot(
        (attribute.anchor.x - centerX) / (attribute.width / 2),
        (attribute.anchor.y - centerY) / (attribute.height / 2),
      );
    const ellipseBoundary = {
      x: centerX + (attribute.anchor.x - centerX) * ellipseScale,
      y: centerY + (attribute.anchor.y - centerY) * ellipseScale,
    };
    const connector = addConnector(attribute.anchor, ellipseBoundary, 1.5);
    connector.setAttribute("class", "attribute-connector");
    connector.setAttribute("data-attribute-owner", attribute.entity);
    svg.append(connector);
  });
  layout.relationships.forEach((relationship, index) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-position-key", `relationship:${index}`);
    group.setAttribute("data-relationship-index", String(index));
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "group");
    group.setAttribute(
      "aria-label",
      `${relationship.label} relationship; drag or use arrow keys to move`,
    );
    group.style.cursor = "grab";
    svg.append(group);
    relationship.links.forEach((link) => {
      group.append(addConnector(link.from, link.to, 1.8));
      const cardinality = addLabel(
        cardinalityText[link.cardinality] ?? link.cardinality,
        (link.from.x + link.to.x) / 2,
        (link.from.y + link.to.y) / 2 - 12,
        16,
        muted,
      );
      if (link.doubleLine)
        group.append(addParallelConnector(link.from, link.to, 1.8, 3.5));
      cardinality.setAttribute("stroke", paper);
      cardinality.setAttribute("stroke-width", "4");
      cardinality.setAttribute("paint-order", "stroke");
      group.append(cardinality);
    });
    const { x, y } = relationship.center;
    const points: [number, number][] = [
      [x, y - relationship.height / 2],
      [x + relationship.width / 2, y],
      [x, y + relationship.height / 2],
      [x - relationship.width / 2, y],
    ];
    group.append(
      roughSvg.polygon(points, {
        seed: 200 + index,
        stroke: ink,
        strokeWidth: 2,
        fill: paper,
        fillStyle: "solid",
      }),
    );
    if (relationship.identifying) {
      group.append(
        roughSvg.polygon(
          [
            [x, y - relationship.height / 2 + 7],
            [x + relationship.width / 2 - 7, y],
            [x, y + relationship.height / 2 - 7],
            [x - relationship.width / 2 + 7, y],
          ],
          {
            seed: 250 + index,
            stroke: ink,
            strokeWidth: 1.6,
            fill: paper,
            fillStyle: "solid",
          },
        ),
      );
    }
    group.append(addLabel(relationship.label, x, y));
  });
  layout.entities.forEach((entity, index) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-entity", entity.name);
    group.setAttribute("data-position-key", entity.name);
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "group");
    group.setAttribute(
      "aria-label",
      `${entity.name} entity; drag or use arrow keys to move`,
    );
    group.style.cursor = "grab";
    svg.append(group);
    group.append(
      roughSvg.rectangle(entity.x, entity.y, entity.width, entity.height, {
        seed: 10 + index,
        stroke: ink,
        strokeWidth: 2,
        fill: paper,
        fillStyle: "solid",
      }),
    );
    if (entity.weak) {
      group.append(
        roughSvg.rectangle(
          entity.x + 6,
          entity.y + 6,
          entity.width - 12,
          entity.height - 12,
          {
            seed: 60 + index,
            stroke: ink,
            strokeWidth: 1.5,
            fill: paper,
            fillStyle: "solid",
          },
        ),
      );
    }
    group.append(
      addLabel(
        entity.name,
        entity.x + entity.width / 2,
        entity.y + entity.height / 2,
      ),
    );
  });
  layout.attributes.forEach((attribute, index) => {
    const field = document.createElementNS("http://www.w3.org/2000/svg", "g");
    field.setAttribute("data-position-key", attribute.positionKey);
    field.setAttribute("data-attribute", attribute.name);
    field.setAttribute("data-attribute-owner", attribute.entity);
    field.setAttribute("tabindex", "0");
    field.setAttribute("role", "group");
    field.setAttribute(
      "aria-label",
      `${attribute.name} ${attribute.entity.startsWith("relationship:") ? "relationship attribute" : attribute.parent ? "component attribute" : "attribute"}; drag or use arrow keys to move`,
    );
    field.style.cursor = "grab";
    svg.append(field);
    const centerX = attribute.x + attribute.width / 2;
    const centerY = attribute.y + attribute.height / 2;
    field.append(
      roughSvg.ellipse(
        attribute.x + attribute.width / 2,
        attribute.y + attribute.height / 2,
        attribute.width,
        attribute.height,
        {
          seed: 400 + index,
          stroke: ink,
          strokeWidth: 1.8,
          fill: paper,
          fillStyle: "solid",
          ...(attribute.partialKey || attribute.derived
            ? { strokeLineDash: [5, 4] }
            : {}),
        },
      ),
    );
    if (attribute.multivalued) {
      field.append(
        roughSvg.ellipse(
          centerX,
          centerY,
          attribute.width - 12,
          attribute.height - 12,
          {
            seed: 450 + index,
            stroke: ink,
            strokeWidth: 1.5,
            fill: paper,
            fillStyle: "solid",
            ...(attribute.partialKey || attribute.derived
              ? { strokeLineDash: [5, 4] }
              : {}),
          },
        ),
      );
    }
    const nameWidth = attribute.name.length * 7.4;
    const keyText = attribute.keys.join("/");
    const fullText = keyText ? `${attribute.name}  ${keyText}` : attribute.name;
    const nameCenterX = keyText ? centerX - keyText.length * 3.7 : centerX;
    if (attribute.keys.includes("PK")) {
      const labelY = attribute.type ? centerY - 9 : centerY;
      const underlineY = labelY + 8;
      const underline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      underline.setAttribute("x1", String(nameCenterX - nameWidth / 2));
      underline.setAttribute("x2", String(nameCenterX + nameWidth / 2));
      underline.setAttribute("y1", String(underlineY));
      underline.setAttribute("y2", String(underlineY));
      underline.setAttribute("stroke", ink);
      underline.setAttribute("stroke-width", "1");
      if (attribute.partialKey)
        underline.setAttribute("stroke-dasharray", "4 2");
      field.append(underline);
    }
    field.append(
      addLabel(
        fullText,
        attribute.x + attribute.width / 2,
        attribute.type ? centerY - 9 : centerY,
        13,
      ),
    );
    if (attribute.type) {
      field.append(
        addLabel(
          attribute.type,
          attribute.x + attribute.width / 2,
          centerY + 12,
          10,
          muted,
        ),
      );
    }
  });
  return svg;
}
