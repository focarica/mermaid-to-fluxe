import "./style.css";
import { createTracePin } from "./interaction";
import { ErParseError, parseErDiagram } from "./parser/parser";
import { renderDiagram } from "./render/render";

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
        <div class="source-label-row"><label for="source">Mermaid ER syntax</label><button class="zoom-button paste-button" id="paste-source" type="button">Paste</button></div>
        <textarea id="source" spellcheck="false" placeholder="erDiagram&#10;  CUSTOMER {&#10;    int id PK&#10;    string name&#10;  }&#10;  ORDER {&#10;    int id PK&#10;  }&#10;  CUSTOMER ||--o{ ORDER : places" aria-describedby="source-help source-error"></textarea>
        <p class="hint" id="source-help">Paste Mermaid ER syntax or type a diagram to see the Chen notation preview.</p>
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
             <button class="zoom-button" id="reset-layout" type="button" aria-label="Reset layout" disabled><span class="action-label-full">Reset layout</span><span class="action-label-short">Reset</span></button>
             <button class="zoom-button" id="clear-trace" type="button" aria-label="Clear pinned trace" disabled>Clear trace</button>
             <button class="zoom-button" id="export-svg" type="button" aria-label="Download SVG" disabled><span class="action-label-full">Download SVG</span><span class="action-label-short">SVG</span></button>
             <button class="export-button" id="export" type="button" aria-label="Download PNG" disabled><span class="action-label-full">Download PNG</span><span class="action-label-short">PNG</span></button>
          </div>
        </div>
        <p class="pin-status" id="pin-status" hidden aria-live="off"></p>
        <figure class="diagram-surface is-empty" tabindex="0" aria-label="Generated entity relationship diagram" aria-describedby="diagram-scroll-hint">
          <div class="diagram-output" id="diagram-output"></div>
          <p class="empty-prompt">Your Chen diagram will appear here.</p>
        </figure>
        <p class="hint" id="diagram-scroll-hint">Hover or focus an item to trace connections; click or press Space to pin one for export. Click again or Clear trace to unpin. Double-click or press Enter on a relationship to center endpoints. Drag items to reposition; arrow keys nudge focused items.</p>
        <p class="status" id="status" role="status" aria-live="polite"></p>
      </section>
    </div>
  </main>`;

const source = document.querySelector<HTMLTextAreaElement>("#source");
const output = document.querySelector<HTMLDivElement>("#diagram-output");
const error = document.querySelector<HTMLParagraphElement>("#source-error");
const status = document.querySelector<HTMLParagraphElement>("#status");
const pinStatus = document.querySelector<HTMLParagraphElement>("#pin-status");
const exportButton = document.querySelector<HTMLButtonElement>("#export");
const svgExportButton =
  document.querySelector<HTMLButtonElement>("#export-svg");
const zoomOutButton = document.querySelector<HTMLButtonElement>("#zoom-out");
const zoomInButton = document.querySelector<HTMLButtonElement>("#zoom-in");
const zoomFitButton = document.querySelector<HTMLButtonElement>("#zoom-fit");
const zoomLevel = document.querySelector<HTMLOutputElement>("#zoom-level");
const resetLayoutButton =
  document.querySelector<HTMLButtonElement>("#reset-layout");
const pasteButton = document.querySelector<HTMLButtonElement>("#paste-source");
const clearTraceButton =
  document.querySelector<HTMLButtonElement>("#clear-trace");
const diagramSurface = document.querySelector<HTMLElement>(".diagram-surface");
if (
  !source ||
  !output ||
  !error ||
  !status ||
  !pinStatus ||
  !exportButton ||
  !svgExportButton ||
  !zoomOutButton ||
  !zoomInButton ||
  !zoomFitButton ||
  !zoomLevel ||
  !resetLayoutButton ||
  !pasteButton ||
  !clearTraceButton ||
  !diagramSurface
) {
  throw new Error("Workbench controls are missing");
}
const sourceControl = source;
const outputRegion = output;
const canvasRegion = diagramSurface;
const pinnedCue = pinStatus;
const errorMessage = error;
const statusMessage = status;
const pngButton = exportButton;
const svgButton = svgExportButton;
const zoomOut = zoomOutButton;
const zoomIn = zoomInButton;
const zoomFit = zoomFitButton;
const zoomReadout = zoomLevel;
const resetLayout = resetLayoutButton;
const pasteSource = pasteButton;
const clearTrace = clearTraceButton;
let currentSvg: SVGSVGElement | undefined;
let currentDiagram: ReturnType<typeof parseErDiagram> | undefined;
const tracePin = createTracePin();
const positionOffsets = new Map<string, { x: number; y: number }>();
let zoom = 1;
let fitToView = true;
let drag:
  | {
      key: string;
      pointerId: number;
      startClient: { x: number; y: number };
      lastClient: { x: number; y: number };
      viewBox: string;
      width: number;
      height: number;
    }
  | undefined;
const minimumZoom = 0.01;
const zoomStep = 1.25;
const touchPoints = new Map<number, { x: number; y: number }>();
let pinch:
  | { distance: number; zoom: number; center: { x: number; y: number } }
  | undefined;

function fitScale(svg: SVGSVGElement): number {
  const width = Number(svg.getAttribute("width"));
  const height = Number(svg.getAttribute("height"));
  const availableWidth = canvasRegion.clientWidth - 50;
  const availableHeight = canvasRegion.clientHeight - 50;
  if (width <= 0 || height <= 0 || availableWidth <= 0 || availableHeight <= 0)
    return 1;
  return Math.min(1, availableWidth / width, availableHeight / height);
}

function updateZoom(): void {
  const svg = currentSvg;
  let overflowing = false;
  if (svg) {
    const naturalWidth = Number(svg.getAttribute("width"));
    const naturalHeight = Number(svg.getAttribute("height"));
    svg.style.width = `${naturalWidth * zoom}px`;
    svg.style.height = "";
    svg.style.transform = "";
    overflowing =
      naturalWidth * zoom > canvasRegion.clientWidth - 50 ||
      naturalHeight * zoom > canvasRegion.clientHeight - 50;
  }
  outputRegion.classList.toggle("is-zoomed", zoom > 1);
  outputRegion.classList.toggle("is-overflowing", overflowing);
  zoomReadout.value = `${Math.round(zoom * 100)}%`;
  zoomReadout.textContent = zoomReadout.value;
  const diagramAvailable = svg !== undefined;
  zoomOut.disabled = !diagramAvailable || zoom <= minimumZoom;
  zoomIn.disabled = !diagramAvailable || !Number.isFinite(zoom * zoomStep);
  zoomFit.disabled = !diagramAvailable;
}

function setManualZoom(
  nextZoom: number,
  focusPoint?: { x: number; y: number },
): void {
  const svg = currentSvg;
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) {
    zoom = nextZoom;
    updateZoom();
    return;
  }
  const canvasBounds = canvasRegion.getBoundingClientRect();
  const center = focusPoint ?? {
    x: canvasBounds.left + canvasBounds.width / 2,
    y: canvasBounds.top + canvasBounds.height / 2,
  };
  const diagramPoint = new DOMPoint(center.x, center.y).matrixTransform(
    matrix.inverse(),
  );
  zoom = nextZoom;
  updateZoom();
  const updatedMatrix = svg.getScreenCTM();
  if (!updatedMatrix) return;
  const updatedCenter = diagramPoint.matrixTransform(updatedMatrix);
  canvasRegion.scrollBy({
    left: updatedCenter.x - center.x,
    top: updatedCenter.y - center.y,
  });
}

function updatePreview(): void {
  if (!sourceControl.value.trim()) {
    outputRegion.replaceChildren();
    tracePin.retain(new Set());
    pinnedCue.textContent = "";
    pinnedCue.hidden = true;
    clearTrace.disabled = true;
    currentSvg = undefined;
    currentDiagram = undefined;
    canvasRegion.classList.add("is-empty");
    updateZoom();
    sourceControl.removeAttribute("aria-invalid");
    errorMessage.textContent = "";
    statusMessage.textContent = "Paste or type Mermaid ER syntax to begin.";
    pngButton.disabled = true;
    svgButton.disabled = true;
    resetLayout.disabled = true;
    return;
  }
  try {
    const diagram = parseErDiagram(sourceControl.value);
    const retainedKeys = new Set([
      ...diagram.entities.map(({ name }) => name),
      ...diagram.entities.flatMap((entity) =>
        entity.attributes.map(
          (attribute) => `attribute:${entity.name}:${attribute.name}`,
        ),
      ),
      ...diagram.entities.flatMap((entity) =>
        entity.attributes.flatMap((attribute) =>
          (attribute.components ?? []).map(
            (component) =>
              `attribute:${entity.name}:${attribute.name}.${component}`,
          ),
        ),
      ),
      ...diagram.relationships.map((_, index) => `relationship:${index}`),
      ...diagram.relationships.flatMap((relationship, index) =>
        (relationship.attributes ?? []).map(
          (attribute) => `relationship-attribute:${index}:${attribute.name}`,
        ),
      ),
    ]);
    for (const key of positionOffsets.keys())
      if (!retainedKeys.has(key)) positionOffsets.delete(key);
    tracePin.retain(retainedKeys);
    const svg = renderDiagram(diagram, document, positionOffsets);
    outputRegion.replaceChildren(svg);
    canvasRegion.classList.remove("is-empty");
    currentSvg = svg;
    currentDiagram = diagram;
    traceConnections(null);
    if (fitToView) zoom = fitScale(svg);
    updateZoom();
    sourceControl.removeAttribute("aria-invalid");
    errorMessage.textContent = "";
    const entityCount = diagram.entities.length;
    const relationshipCount = diagram.relationships.length;
    statusMessage.textContent = `${entityCount} ${entityCount === 1 ? "entity" : "entities"} · ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}`;
    pngButton.disabled = false;
    svgButton.disabled = false;
    resetLayout.disabled = positionOffsets.size === 0;
  } catch (cause) {
    if (!(cause instanceof ErParseError)) throw cause;
    outputRegion.replaceChildren();
    canvasRegion.classList.remove("is-empty");
    currentSvg = undefined;
    currentDiagram = undefined;
    updateZoom();
    sourceControl.setAttribute("aria-invalid", "true");
    errorMessage.textContent = cause.message;
    statusMessage.textContent = "Fix the source to generate a diagram.";
    pngButton.disabled = true;
    svgButton.disabled = true;
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

function touchDistance(): number | undefined {
  if (touchPoints.size !== 2) return undefined;
  const [first, second] = [...touchPoints.values()];
  return first && second
    ? Math.hypot(second.x - first.x, second.y - first.y)
    : undefined;
}

function touchCenter(): { x: number; y: number } | undefined {
  if (touchPoints.size !== 2) return undefined;
  const [first, second] = [...touchPoints.values()];
  return first && second
    ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
    : undefined;
}

canvasRegion.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.pointerType !== "touch") return;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const distance = touchDistance();
  const center = touchCenter();
  if (distance && center && currentSvg) {
    drag = undefined;
    pinch = { distance, zoom, center };
    canvasRegion.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
});

canvasRegion.addEventListener("pointermove", (event: PointerEvent) => {
  const previousPoint = touchPoints.get(event.pointerId);
  if (!previousPoint) return;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (touchPoints.size === 1 && !drag) {
    canvasRegion.scrollBy({
      left: previousPoint.x - event.clientX,
      top: previousPoint.y - event.clientY,
    });
    event.preventDefault();
    return;
  }
  const distance = touchDistance();
  const center = touchCenter();
  if (!distance || !center || !pinch) return;
  fitToView = false;
  setManualZoom(
    Math.max(minimumZoom, pinch.zoom * (distance / pinch.distance)),
    center,
  );
  event.preventDefault();
});

const endTouchGesture = (event: PointerEvent): void => {
  touchPoints.delete(event.pointerId);
  if (touchPoints.size < 2) pinch = undefined;
};
canvasRegion.addEventListener("pointerup", endTouchGesture);
canvasRegion.addEventListener("pointercancel", endTouchGesture);

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
    startClient: { x: event.clientX, y: event.clientY },
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

function traceConnections(group: SVGGElement | null): void {
  const svg = currentSvg;
  if (!svg) return;
  const activeKey = tracePin.activeKey(
    group?.getAttribute("data-position-key") ?? null,
  );
  const pinnedKey = tracePin.activeKey(null);
  const activeGroup = activeKey
    ? svg.querySelector<SVGGElement>(
        `[data-position-key="${CSS.escape(activeKey)}"]`,
      )
    : null;
  clearTrace.disabled = tracePin.activeKey(null) === null;
  svg.classList.toggle("is-pinned-tracing", pinnedKey !== null);
  pinnedCue.hidden = pinnedKey === null;
  pinnedCue.textContent =
    pinnedKey === null
      ? ""
      : `Pinned for export: ${pinnedTargetName(activeGroup, pinnedKey)}`;
  const groups = svg.querySelectorAll<SVGGElement>("g[data-position-key]");
  groups.forEach((item) => {
    if (item === activeGroup && tracePin.activeKey(null) !== null) {
      item.setAttribute("aria-description", "Pinned trace");
    } else {
      item.removeAttribute("aria-description");
    }
  });
  const attributeOwner = activeGroup?.getAttribute("data-attribute-owner");
  const key = activeGroup?.getAttribute("data-position-key");
  const entity =
    activeGroup?.getAttribute("data-entity") ??
    (attributeOwner && !attributeOwner.startsWith("relationship:")
      ? attributeOwner
      : null);
  const selectedRelationship =
    activeGroup?.getAttribute("data-relationship-index") ??
    (attributeOwner?.startsWith("relationship:")
      ? attributeOwner.slice("relationship:".length)
      : key?.startsWith("relationship:")
        ? key.slice("relationship:".length)
        : null);
  if (!activeGroup || (!entity && selectedRelationship === null)) {
    svg.classList.remove("is-tracing");
    groups.forEach((item) => {
      item.classList.remove("is-dimmed", "is-trace-focus", "is-trace-context");
    });
    svg.querySelectorAll(".attribute-connector.is-dimmed").forEach((line) => {
      line.classList.remove("is-dimmed");
    });
    return;
  }

  const relationshipIndexes =
    currentDiagram?.relationships.flatMap((relationship, index) =>
      entity && (relationship.from === entity || relationship.to === entity)
        ? [index]
        : selectedRelationship === String(index)
          ? [index]
          : [],
    ) ?? [];
  const endpointNames = new Set<string>(entity ? [entity] : []);
  for (const index of relationshipIndexes) {
    const relationship = currentDiagram?.relationships[index];
    if (relationship) {
      endpointNames.add(relationship.from);
      endpointNames.add(relationship.to);
    }
  }
  const visibleKeys = new Set<string>([
    ...endpointNames,
    ...relationshipIndexes.map((index) => `relationship:${index}`),
    ...(entity
      ? [...svg.querySelectorAll<SVGGElement>("g[data-attribute-owner]")]
          .filter(
            (item) => item.getAttribute("data-attribute-owner") === entity,
          )
          .map((item) => item.getAttribute("data-position-key"))
          .filter((value): value is string => value !== null)
      : []),
    ...relationshipIndexes.flatMap((index) =>
      [...svg.querySelectorAll<SVGGElement>("g[data-attribute-owner]")]
        .filter(
          (item) =>
            item.getAttribute("data-attribute-owner") ===
            `relationship:${index}`,
        )
        .map((item) => item.getAttribute("data-position-key"))
        .filter((value): value is string => value !== null),
    ),
  ]);
  svg.classList.add("is-tracing");
  groups.forEach((item) => {
    const itemKey = item.getAttribute("data-position-key");
    item.classList.toggle("is-dimmed", !itemKey || !visibleKeys.has(itemKey));
    item.classList.toggle("is-trace-focus", item === activeGroup);
    item.classList.toggle(
      "is-trace-context",
      item !== activeGroup && Boolean(itemKey && visibleKeys.has(itemKey)),
    );
  });
  svg
    .querySelectorAll<SVGLineElement>(".attribute-connector")
    .forEach((line) => {
      const owner = line.getAttribute("data-attribute-owner");
      const visible =
        (owner !== null && endpointNames.has(owner) && owner === entity) ||
        (owner !== null &&
          relationshipIndexes.some(
            (index) => owner === `relationship:${index}`,
          ));
      line.classList.toggle("is-dimmed", !visible);
    });
}

function pinnedTargetName(group: SVGGElement | null, key: string): string {
  const entity = group?.getAttribute("data-entity");
  if (entity) return entity;
  const owner = group?.getAttribute("data-attribute-owner");
  const attribute = group?.getAttribute("data-attribute");
  if (owner && attribute) {
    if (owner.startsWith("relationship:")) {
      const relationshipIndex = Number(owner.slice("relationship:".length));
      const label = currentDiagram?.relationships[relationshipIndex]?.label;
      return label ? `${label}.${attribute}` : key;
    }
    return `${owner}.${attribute}`;
  }
  const relationshipIndex = Number(
    group?.getAttribute("data-relationship-index") ??
      key.slice("relationship:".length),
  );
  if (Number.isInteger(relationshipIndex) && relationshipIndex >= 0) {
    return currentDiagram?.relationships[relationshipIndex]?.label ?? key;
  }
  return key;
}

function reapplyPinnedTrace(): void {
  if (tracePin.activeKey(null) !== null) traceConnections(null);
}

function centerRelationship(group: SVGGElement): void {
  if (group.getAttribute("data-relationship-index") === null) return;
  const initialBounds = group.getBoundingClientRect();
  const fitFactor = Math.min(
    1,
    (canvasRegion.clientWidth - 120) / Math.max(initialBounds.width, 1),
    (canvasRegion.clientHeight - 120) / Math.max(initialBounds.height, 1),
  );
  if (fitFactor < 1) {
    setManualZoom(Math.max(minimumZoom, zoom * fitFactor));
  }
  const relationshipBounds = group.getBoundingClientRect();
  const canvasBounds = canvasRegion.getBoundingClientRect();
  canvasRegion.scrollBy({
    left:
      relationshipBounds.left +
      relationshipBounds.width / 2 -
      (canvasBounds.left + canvasBounds.width / 2),
    top:
      relationshipBounds.top +
      relationshipBounds.height / 2 -
      (canvasBounds.top + canvasBounds.height / 2),
  });
}

outputRegion.addEventListener("dblclick", (event: MouseEvent) => {
  const group =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("g[data-relationship-index]")
      : null;
  if (group) centerRelationship(group);
});

outputRegion.addEventListener("pointerover", (event: PointerEvent) => {
  const group =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("g[data-position-key]")
      : null;
  if (group) traceConnections(group);
});
outputRegion.addEventListener("pointerout", (event: PointerEvent) => {
  const previous =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("g[data-position-key]")
      : null;
  const next =
    event.relatedTarget instanceof Element
      ? event.relatedTarget.closest<SVGGElement>("g[data-position-key]")
      : null;
  if (previous && previous !== next) traceConnections(next);
});
outputRegion.addEventListener("focusin", (event: FocusEvent) => {
  const group =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("g[data-position-key]")
      : null;
  if (group) traceConnections(group);
});
outputRegion.addEventListener("focusout", (event: FocusEvent) => {
  const next =
    event.relatedTarget instanceof Element
      ? event.relatedTarget.closest<SVGGElement>("g[data-position-key]")
      : null;
  traceConnections(next);
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
  reapplyPinnedTrace();
});
const endDrag = (event: PointerEvent): void => {
  const activeDrag = drag;
  if (activeDrag?.pointerId !== event.pointerId) return;
  const clickDistance = Math.hypot(
    event.clientX - activeDrag.startClient.x,
    event.clientY - activeDrag.startClient.y,
  );
  // Ignore small pointer jitter; movement beyond 5 CSS pixels is a drag.
  const shouldPin = event.type === "pointerup" && clickDistance <= 5;
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
  if (shouldPin) {
    const group = svg.querySelector<SVGGElement>(
      `[data-position-key="${CSS.escape(activeDrag.key)}"]`,
    );
    if (group) {
      tracePin.toggle(activeDrag.key);
      traceConnections(null);
    }
  } else {
    reapplyPinnedTrace();
  }
};
outputRegion.addEventListener("pointerup", endDrag);
outputRegion.addEventListener("pointercancel", endDrag);
outputRegion.addEventListener("lostpointercapture", endDrag);

outputRegion.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!currentDiagram) return;
  const item =
    event.target instanceof Element
      ? event.target.closest<SVGGElement>("[data-position-key]")
      : null;
  const key = item?.getAttribute("data-position-key");
  if (!item || !key) return;
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    tracePin.toggle(key);
    traceConnections(null);
    return;
  }
  if (event.key === "Enter" && item.hasAttribute("data-relationship-index")) {
    event.preventDefault();
    centerRelationship(item);
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
    return;
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
  reapplyPinnedTrace();
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
  embedTraceStyles(copy);
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
    const scale = Math.min(
      4,
      16000 / width,
      16000 / height,
      Math.sqrt(40_000_000 / (width * height)),
    );
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
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

function downloadSvg(): void {
  const svg = currentSvg;
  if (!svg) return;
  const { width, height } = svg.viewBox.baseVal;
  const copy = svg.cloneNode(true);
  if (!(copy instanceof SVGSVGElement)) return;
  embedTraceStyles(copy);
  copy.style.removeProperty("width");
  copy.style.removeProperty("height");
  copy.style.removeProperty("transform");
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  const downloadUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "fluxe-erd.svg";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  statusMessage.textContent = "SVG downloaded.";
}

function embedTraceStyles(copy: SVGSVGElement): void {
  if (tracePin.activeKey(null) === null) return;
  copy
    .querySelectorAll<SVGGElement>("g[data-position-key]")
    .forEach((group) => {
      if (group.classList.contains("is-dimmed")) group.style.opacity = "0.08";
      if (group.classList.contains("is-trace-context"))
        group.style.opacity = "0.82";
      if (group.classList.contains("is-trace-focus")) {
        group.style.opacity = "1";
        group.style.filter = "drop-shadow(0 0 3px rgb(166 79 54 / 42%))";
      }
    });
  copy
    .querySelectorAll<SVGElement>(".attribute-connector.is-dimmed")
    .forEach((line) => {
      line.style.opacity = "0.08";
    });
}

sourceControl.addEventListener("input", updatePreview);
clearTrace.addEventListener("click", () => {
  tracePin.clear();
  pinnedCue.textContent = "";
  pinnedCue.hidden = true;
  traceConnections(null);
});
pasteSource.addEventListener("click", async () => {
  try {
    sourceControl.value = await navigator.clipboard.readText();
    sourceControl.focus();
    updatePreview();
  } catch {
    statusMessage.textContent =
      "Clipboard access is unavailable. Paste into the editor instead.";
    sourceControl.focus();
  }
});
resetLayout.addEventListener("click", () => {
  positionOffsets.clear();
  const diagram = currentDiagram;
  if (!diagram) return;
  const svg = renderDiagram(diagram, document, positionOffsets);
  outputRegion.replaceChildren(svg);
  currentSvg = svg;
  updateZoom();
  resetLayout.disabled = true;
  reapplyPinnedTrace();
});
pngButton.addEventListener("click", downloadPng);
svgButton.addEventListener("click", downloadSvg);
zoomOut.addEventListener("click", () => {
  fitToView = false;
  setManualZoom(Math.max(minimumZoom, zoom / zoomStep));
});
zoomIn.addEventListener("click", () => {
  fitToView = false;
  setManualZoom(zoom * zoomStep);
});
zoomFit.addEventListener("click", () => {
  fitToView = true;
  if (currentSvg) zoom = fitScale(currentSvg);
  diagramSurface.scrollTo({ left: 0, top: 0 });
  updateZoom();
});
window.addEventListener("resize", () => {
  if (!fitToView || !currentSvg) return;
  zoom = fitScale(currentSvg);
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
