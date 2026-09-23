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
          <button class="export-button" id="export" type="button" disabled>Download PNG</button>
        </div>
        <figure class="diagram-surface" tabindex="0" aria-label="Generated entity relationship diagram" aria-describedby="diagram-scroll-hint">
          <div class="diagram-output" id="diagram-output"></div>
        </figure>
        <p class="hint" id="diagram-scroll-hint">Wide diagrams may need horizontal scrolling.</p>
        <p class="status" id="status" role="status" aria-live="polite"></p>
      </section>
    </div>
  </main>`;

const source = document.querySelector<HTMLTextAreaElement>("#source");
const output = document.querySelector<HTMLDivElement>("#diagram-output");
const error = document.querySelector<HTMLParagraphElement>("#source-error");
const status = document.querySelector<HTMLParagraphElement>("#status");
const exportButton = document.querySelector<HTMLButtonElement>("#export");
const diagramSurface = document.querySelector<HTMLElement>(".diagram-surface");
if (
  !source ||
  !output ||
  !error ||
  !status ||
  !exportButton ||
  !diagramSurface
) {
  throw new Error("Workbench controls are missing");
}
const sourceControl = source;
const outputRegion = output;
const errorMessage = error;
const statusMessage = status;
const pngButton = exportButton;

sourceControl.value = sample;
let currentSvg: SVGSVGElement | undefined;

function updatePreview(): void {
  try {
    const diagram = parseErDiagram(sourceControl.value);
    const svg = renderDiagram(diagram);
    outputRegion.replaceChildren(svg);
    currentSvg = svg;
    sourceControl.removeAttribute("aria-invalid");
    errorMessage.textContent = "";
    const entityCount = diagram.entities.length;
    const relationshipCount = diagram.relationships.length;
    statusMessage.textContent = `${entityCount} ${entityCount === 1 ? "entity" : "entities"} · ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}`;
    pngButton.disabled = false;
  } catch (cause) {
    if (!(cause instanceof ErParseError)) throw cause;
    outputRegion.replaceChildren();
    currentSvg = undefined;
    sourceControl.setAttribute("aria-invalid", "true");
    errorMessage.textContent = cause.message;
    statusMessage.textContent = "Fix the source to generate a diagram.";
    pngButton.disabled = true;
  }
}

function downloadPng(): void {
  const svg = currentSvg;
  if (!svg) return;

  const { width, height } = svg.viewBox.baseVal;
  const copy = svg.cloneNode(true);
  if (!(copy instanceof SVGSVGElement)) return;
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
pngButton.addEventListener("click", downloadPng);
diagramSurface.addEventListener("keydown", (event: KeyboardEvent) => {
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
