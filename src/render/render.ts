import rough from "roughjs";
import type { Diagram } from "../parser/model";
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
  const entityDescriptions = diagram.entities.map((entity) => {
    const attributes = entity.attributes.map((attribute) => {
      const type = attribute.type ? `, type ${attribute.type}` : "";
      const keys = attribute.keys.length
        ? `, ${attribute.keys.join(", ")}`
        : "";
      const comment = attribute.comment ? `, comment ${attribute.comment}` : "";
      return `${attribute.name}${type}${keys}${comment}`;
    });
    return `${entity.name}: ${attributes.join("; ") || "no attributes"}`;
  });
  const relationshipDescriptions = diagram.relationships.map(
    (relationship) =>
      `${relationship.from} (${cardinalityText[relationship.fromCardinality] ?? relationship.fromCardinality}) ${relationship.identifying ? "identifying" : "non-identifying"} relationship “${relationship.label}” to ${relationship.to} (${cardinalityText[relationship.toCardinality] ?? relationship.toCardinality})`,
  );
  return `Entities: ${entityDescriptions.join(". ") || "none"}. Relationships: ${relationshipDescriptions.join(". ") || "none"}.`;
}

export function renderDiagram(
  diagram: Diagram,
  document: Document = window.document,
): SVGSVGElement {
  const layout = layoutDiagram(diagram);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute(
    "viewBox",
    `${layout.bounds.x} ${layout.bounds.y} ${layout.bounds.width} ${layout.bounds.height}`,
  );
  svg.setAttribute("width", String(layout.bounds.width));
  svg.setAttribute("height", String(layout.bounds.height));
  svg.style.width = "100%";
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
  ): void => {
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
  };
  layout.relationships.forEach((relationship, index) => {
    relationship.links.forEach((link, linkIndex) => {
      svg.append(
        roughSvg.line(link.from.x, link.from.y, link.to.x, link.to.y, {
          seed: 100 + index * 4 + linkIndex,
          stroke: ink,
          strokeWidth: 1.8,
        }),
      );
      addLabel(
        cardinalityText[link.cardinality] ?? link.cardinality,
        (link.from.x + link.to.x) / 2,
        (link.from.y + link.to.y) / 2 - 12,
        13,
        muted,
      );
    });
  });
  layout.attributes.forEach((attribute, index) => {
    svg.append(
      roughSvg.line(
        attribute.anchor.x,
        attribute.anchor.y,
        attribute.x + attribute.width / 2,
        attribute.y + attribute.height / 2,
        { seed: 300 + index, stroke: ink, strokeWidth: 1.5 },
      ),
    );
  });
  layout.relationships.forEach((relationship, index) => {
    const { x, y } = relationship.center;
    const points: [number, number][] = [
      [x, y - relationship.height / 2],
      [x + relationship.width / 2, y],
      [x, y + relationship.height / 2],
      [x - relationship.width / 2, y],
    ];
    svg.append(
      roughSvg.polygon(points, {
        seed: 200 + index,
        stroke: ink,
        strokeWidth: 2,
        fill: paper,
        fillStyle: "solid",
      }),
    );
    if (relationship.identifying) {
      svg.append(
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
    addLabel(relationship.label, x, y);
  });
  layout.entities.forEach((entity, index) => {
    svg.append(
      roughSvg.rectangle(entity.x, entity.y, entity.width, entity.height, {
        seed: 10 + index,
        stroke: ink,
        strokeWidth: 2,
        fill: paper,
        fillStyle: "solid",
      }),
    );
    addLabel(
      entity.name,
      entity.x + entity.width / 2,
      entity.y + entity.height / 2,
    );
  });
  layout.attributes.forEach((attribute, index) => {
    svg.append(
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
        },
      ),
    );
    const centerX = attribute.x + attribute.width / 2;
    const nameWidth = attribute.name.length * 7.4;
    const keyText = attribute.keys.join("/");
    const fullText = keyText ? `${attribute.name}  ${keyText}` : attribute.name;
    const nameCenterX = keyText ? centerX - keyText.length * 3.7 : centerX;
    if (attribute.keys.includes("PK")) {
      const baselineY = attribute.y + attribute.height / 2 + 5;
      const underline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      underline.setAttribute("x1", String(nameCenterX - nameWidth / 2));
      underline.setAttribute("x2", String(nameCenterX + nameWidth / 2));
      underline.setAttribute("y1", String(baselineY + 2));
      underline.setAttribute("y2", String(baselineY + 2));
      underline.setAttribute("stroke", ink);
      underline.setAttribute("stroke-width", "1");
      svg.append(underline);
    }
    addLabel(
      fullText,
      attribute.x + attribute.width / 2,
      attribute.y + attribute.height / 2,
      13,
    );
    if (attribute.type)
      addLabel(
        attribute.type,
        attribute.x + attribute.width / 2,
        attribute.y + attribute.height + 12,
        10,
        muted,
      );
  });
  return svg;
}
