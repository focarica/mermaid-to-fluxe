import "./style.css";
import { ErParseError, parseErDiagram } from "./parser/parser";
import { renderDiagram } from "./render/render";

const sample = `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email UK
  }
  ORDER {
    int id PK
    date placed_at
  }
  CUSTOMER ||--o{ ORDER : places`;

const app = document.getElementById("app");
if (!(app instanceof HTMLElement)) throw new Error("App root is missing");

app.innerHTML = `
  <main class="workbench">
    <header class="masthead">
      <a class="wordmark" href="#" aria-label="Fluxe home">fluxe<span>.</span></a>
      <p>Mermaid in. Chen diagram out.</p>
    </header>
    <div class="workspace">
      <section class="source-panel" aria-labelledby="source-title">
        <div class="panel-heading">
          <div><p class="eyebrow">SOURCE</p><h1 id="source-title">ER diagram</h1></div>
          <span class="format-tag">MERMAID ER</span>
        </div>
        <label for="source">Mermaid ER syntax</label>
        <textarea id="source" spellcheck="false" aria-describedby="source-help source-error"></textarea>
        <p class="hint" id="source-help">Edit the sample or paste your own <code>erDiagram</code>.</p>
        <p class="error" id="source-error" role="alert" aria-live="polite"></p>
      </section>
      <section class="diagram-panel" aria-labelledby="diagram-title">
        <div class="diagram-heading">
          <div><p class="eyebrow">PREVIEW</p><h2 id="diagram-title">Chen notation</h2></div>
          <div class="diagram-actions">
            <div class="zoom-controls" role="group" aria-label="Diagram zoom controls">
              <button class="zoom-button" id="zoom-out" type="button" aria-label="Zoom out" disabled>−</button>
              <output class="zoom-level" id="zoom-level" aria-live="polite">100%</output>
              <button class="zoom-button" id="zoom-in" type="button" aria-label="Zoom in">+</button>
              <button class="zoom-button zoom-fit" id="zoom-fit" type="button">Fit</button>
            </div>
             <button class="zoom-button" id="reset-layout" type="button" disabled>Reset layout</button>
             <button class="export-button" id="export" type="button" disabled>Download PNG</button>
          </div>
        </div>
        <figure class="diagram-surface" tabindex="0" aria-label="Generated entity relationship diagram" aria-describedby="diagram-scroll-hint">
          <div class="diagram-output" id="diagram-output"></div>
        </figure>
        <p class="hint" id="diagram-scroll-hint">Drag entities, attributes, and relationships to reposition; arrow keys nudge focused items. Positions last for this session only. Wide diagrams may need horizontal scrolling.</p>
        <p class="status" id="status" role="status" aria-live="polite"></p>
      </section>
    </div>
  </main>`;

const source = document.querySelector<HTMLTextAreaElement>("#source");
const output = document.querySelector<HTMLDivElement>("#diagram-output");
const error = document.querySelector<HTMLParagraphElement>("#source-error");
const status = document.querySelector<HTMLParagraphElement>("#status");
const exportButton = document.querySelector<HTMLButtonElement>("#export");
const zoomOutButton = document.querySelector<HTMLButtonElement>("#zoom-out");
const zoomInButton = document.querySelector<HTMLButtonElement>("#zoom-in");
const zoomFitButton = document.querySelector<HTMLButtonElement>("#zoom-fit");
const zoomLevel = document.querySelector<HTMLOutputElement>("#zoom-level");
const resetLayoutButton =
  document.querySelector<HTMLButtonElement>("#reset-layout");
const diagramSurface = document.querySelector<HTMLElement>(".diagram-surface");
if (
  !source ||
  !output ||
  !error ||
  !status ||
  !exportButton ||
  !zoomOutButton ||
  !zoomInButton ||
  !zoomFitButton ||
  !zoomLevel ||
  !resetLayoutButton ||
  !diagramSurface
) {
  throw new Error("Workbench controls are missing");
}
const sourceControl = source;
const outputRegion = output;
const errorMessage = error;
const statusMessage = status;
const pngButton = exportButton;
const zoomOut = zoomOutButton;
const zoomIn = zoomInButton;
const zoomFit = zoomFitButton;
const zoomReadout = zoomLevel;
const resetLayout = resetLayoutButton;

sourceControl.value = sample;
let currentSvg: SVGSVGElement | undefined;
let currentDiagram: ReturnType<typeof parseErDiagram> | undefined;
const positionOffsets = new Map<string, { x: number; y: number }>();
let zoom = 1;
let drag:
  | {
      key: string;
      pointerId: number;
      lastClient: { x: number; y: number };
      viewBox: string;
      width: number;
      height: number;
    }
  | undefined;
const minimumZoom = 0.5;
const maximumZoom = 2;
const zoomStep = 0.25;

function updateZoom(): void {
  const svg = currentSvg;
  if (svg) {
    svg.style.width = `${zoom * 100}%`;
    svg.style.height = "";
    svg.style.transform = "";
  }
  outputRegion.classList.toggle("is-zoomed", zoom > 1);
  zoomReadout.value = `${Math.round(zoom * 100)}%`;
  zoomReadout.textContent = zoomReadout.value;
  const diagramAvailable = svg !== undefined;
  zoomOut.disabled = !diagramAvailable || zoom <= minimumZoom;
  zoomIn.disabled = !diagramAvailable || zoom >= maximumZoom;
  zoomFit.disabled = !diagramAvailable;
}

function updatePreview(): void {
  try {
    const diagram = parseErDiagram(sourceControl.value);
    const retainedKeys = new Set([
      ...diagram.entities.map(({ name }) => name),
      ...diagram.entities.flatMap((entity) =>
        entity.attributes.map(
          (attribute) => `attribute:${entity.name}:${attribute.name}`,
        ),
      ),
      ...diagram.relationships.map((_, index) => `relationship:${index}`),
    ]);
    for (const key of positionOffsets.keys())
      if (!retainedKeys.has(key)) positionOffsets.delete(key);
    const svg = renderDiagram(diagram, document, positionOffsets);
    outputRegion.replaceChildren(svg);
    currentSvg = svg;
    currentDiagram = diagram;
    updateZoom();
    sourceControl.removeAttribute("aria-invalid");
    errorMessage.textContent = "";
    const entityCount = diagram.entities.length;
    const relationshipCount = diagram.relationships.length;
    statusMessage.textContent = `${entityCount} ${entityCount === 1 ? "entity" : "entities"} · ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}`;
    pngButton.disabled = false;
    resetLayout.disabled = positionOffsets.size === 0;
  } catch (cause) {
    if (!(cause instanceof ErParseError)) throw cause;
    outputRegion.replaceChildren();
    currentSvg = undefined;
    currentDiagram = undefined;
    updateZoom();
    sourceControl.setAttribute("aria-invalid", "true");
    errorMessage.textContent = cause.message;
    statusMessage.textContent = "Fix the source to generate a diagram.";
    pngButton.disabled = true;
    resetLayout.disabled = true;
  }
}

function diagramPoint(
  clientX: number,
  clientY: number,
): { x: number; y: number } | undefined {
  const svg = currentSvg;
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return undefined;
  const local = new DOMPoint(clientX, clientY).matrixTransform(
    matrix.inverse(),
  );
  return { x: local.x, y: local.y };
}

outputRegion.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0 || !event.isPrimary) return;
  const group =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("[data-position-key]")
      : null;
  const key = group?.getAttribute("data-position-key");
  if (!group || !key || !diagramPoint(event.clientX, event.clientY)) return;
  const viewBox = currentSvg?.getAttribute("viewBox");
  const svgBounds = currentSvg?.getBoundingClientRect();
  if (!viewBox || !svgBounds) return;
  drag = {
    key,
    pointerId: event.pointerId,
    lastClient: { x: event.clientX, y: event.clientY },
    viewBox,
    width: svgBounds.width,
    height: svgBounds.height,
  };
  outputRegion.classList.add("is-dragging");
  outputRegion.style.cursor = "grabbing";
  outputRegion.setPointerCapture(event.pointerId);
  group.style.cursor = "grabbing";
  event.preventDefault();
});
outputRegion.addEventListener("pointermove", (event: PointerEvent) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const point = diagramPoint(event.clientX, event.clientY);
  const previousPoint = diagramPoint(drag.lastClient.x, drag.lastClient.y);
  if (!point || !previousPoint || !currentDiagram) return;
  const offset = positionOffsets.get(drag.key) ?? { x: 0, y: 0 };
  positionOffsets.set(drag.key, {
    x: offset.x + point.x - previousPoint.x,
    y: offset.y + point.y - previousPoint.y,
  });
  drag.lastClient = { x: event.clientX, y: event.clientY };
  const svg = renderDiagram(currentDiagram, document, positionOffsets);
  svg.setAttribute("viewBox", drag.viewBox);
  svg
    .querySelector<SVGGElement>(`[data-position-key="${CSS.escape(drag.key)}"]`)
    ?.style.setProperty("cursor", "grabbing");
  outputRegion.replaceChildren(svg);
  currentSvg = svg;
  updateZoom();
  svg.style.width = `${drag.width}px`;
  svg.style.height = `${drag.height}px`;
  svg.style.overflow = "visible";
  resetLayout.disabled = false;
});
const endDrag = (event: PointerEvent): void => {
  const activeDrag = drag;
  if (activeDrag?.pointerId !== event.pointerId) return;
  const previousSvg = currentSvg;
  const previousBounds = previousSvg?.getBoundingClientRect();
  const previousMatrix = previousSvg?.getScreenCTM();
  const previousViewBox = previousSvg?.viewBox.baseVal;
  drag = undefined;
  outputRegion.classList.remove("is-dragging");
  outputRegion.style.removeProperty("cursor");
  if (!currentDiagram || !previousBounds || !previousMatrix || !previousViewBox)
    return;
  const svg = renderDiagram(currentDiagram, document, positionOffsets);
  outputRegion.replaceChildren(svg);
  currentSvg = svg;
  updateZoom();
  const viewBox = svg.viewBox.baseVal;
  const scaleX = previousMatrix.a;
  const scaleY = previousMatrix.d;
  const desiredLeft =
    previousBounds.left + (viewBox.x - previousViewBox.x) * scaleX;
  const desiredTop =
    previousBounds.top + (viewBox.y - previousViewBox.y) * scaleY;
  svg.style.width = `${viewBox.width * scaleX}px`;
  svg.style.height = `${viewBox.height * scaleY}px`;
  const expandedBounds = svg.getBoundingClientRect();
  svg.style.transform = `translate(${desiredLeft - expandedBounds.left}px, ${desiredTop - expandedBounds.top}px)`;
  resetLayout.disabled = positionOffsets.size === 0;
};
outputRegion.addEventListener("pointerup", endDrag);
outputRegion.addEventListener("pointercancel", endDrag);
outputRegion.addEventListener("lostpointercapture", endDrag);

outputRegion.addEventListener("keydown", (event: KeyboardEvent) => {
  if (
    !currentDiagram ||
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  )
    return;
  const item =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("[data-position-key]")
      : null;
  const key = item?.getAttribute("data-position-key");
  if (!key) return;
  event.preventDefault();
  const offset = positionOffsets.get(key) ?? { x: 0, y: 0 };
  const step = event.shiftKey ? 20 : 8;
  const dx =
    event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
  const dy =
    event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
  positionOffsets.set(key, { x: offset.x + dx, y: offset.y + dy });
  const svg = renderDiagram(currentDiagram, document, positionOffsets);
  outputRegion.replaceChildren(svg);
  currentSvg = svg;
  updateZoom();
  resetLayout.disabled = false;
  outputRegion
    .querySelector<SVGGElement>(`[data-position-key="${CSS.escape(key)}"]`)
    ?.focus();
});

function downloadPng(): void {
  const svg = currentSvg;
  if (!svg) return;

  const { width, height } = svg.viewBox.baseVal;
  const copy = svg.cloneNode(true);
  if (!(copy instanceof SVGSVGElement)) return;
  copy.style.removeProperty("width");
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  const imageUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * 2);
    canvas.height = Math.ceil(height * 2);
    const context = canvas.getContext("2d");
    if (!context) {
      statusMessage.textContent = "PNG export is unavailable in this browser.";
      return;
    }
    context.fillStyle = "#fffdf7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        statusMessage.textContent = "Could not create the PNG image.";
        return;
      }
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "fluxe-erd.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      statusMessage.textContent = "PNG downloaded.";
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    statusMessage.textContent = "Could not render the PNG image.";
  };
  image.src = imageUrl;
}

sourceControl.addEventListener("input", updatePreview);
resetLayout.addEventListener("click", () => {
  positionOffsets.clear();
  const diagram = currentDiagram;
  if (!diagram) return;
  const svg = renderDiagram(diagram, document, positionOffsets);
  outputRegion.replaceChildren(svg);
  currentSvg = svg;
  updateZoom();
  resetLayout.disabled = true;
});
pngButton.addEventListener("click", downloadPng);
zoomOut.addEventListener("click", () => {
  zoom = Math.max(minimumZoom, zoom - zoomStep);
  updateZoom();
});
zoomIn.addEventListener("click", () => {
  zoom = Math.min(maximumZoom, zoom + zoomStep);
  updateZoom();
});
zoomFit.addEventListener("click", () => {
  zoom = 1;
  diagramSurface.scrollTo({ left: 0, top: 0 });
  updateZoom();
});
diagramSurface.addEventListener("keydown", (event: KeyboardEvent) => {
  if (
    event.target instanceof Element &&
    event.target.closest("[data-position-key]")
  )
    return;
  const scrollStep = 120;
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      diagramSurface.scrollBy({ left: -scrollStep });
      break;
    case "ArrowRight":
      event.preventDefault();
      diagramSurface.scrollBy({ left: scrollStep });
      break;
    case "ArrowUp":
      event.preventDefault();
      diagramSurface.scrollBy({ top: -scrollStep });
      break;
    case "ArrowDown":
      event.preventDefault();
      diagramSurface.scrollBy({ top: scrollStep });
      break;
  }
});
updatePreview();
