// Pan/zoom controller for a canvas-style SVG: wheel zooms toward the cursor,
// drag pans (move/up listeners on window, so panning continues outside the
// svg), both coalesced into one rAF frame — listeners only record intent, the
// frame callback reads layout once, then writes. The transform is applied to
// a single <g> as `translate(x,y) scale(s)`; callers that drag their own
// nodes read the live scale/translate to convert client -> user space.

import {clamp} from "../lib/utils.ts";

const ZOOM_STEP = 1.1;

// Dot grid: 40px tile, 2px dot; offset matches the original SVG pattern.
const GRID_BACKGROUND = "var(--color-dark-6) radial-gradient(var(--color-dark-5) 2px, transparent 2.5px) -4px -16px / 40px 40px";
// Dot offset inside the tile: backgroundPosition must track the pan minus
// these so the dots move exactly with the content.
const GRID_OFFSET_X = -4;
const GRID_OFFSET_Y = -16;

export default function PanZoom(
  svg: SVGSVGElement,
  group: SVGGElement,
  options: {
    minScale?: number,
    maxScale?: number,
  } = {},
): {
  readonly scale: number,
  readonly translate: [number, number],
  // Center content of the given size in the svg, scaled to fit.
  fit(width: number, height: number, options?: {padding?: number, maxScale?: number, offsetY?: number}): void,
  reset(): void,
  unmount(): void,
} {
  const minScale = options.minScale ?? 0.1;
  const maxScale = options.maxScale ?? 5;
  let scale = 1;
  let translate: [number, number] = [0, 0];
  let panning = false;
  let last: [number, number] = [0, 0];
  // Accumulated zoom factor + latest wheel per frame: zoom-toward-cursor
  // needs one anchor point, the factor accumulates across fast scrolls.
  let pendingZoom = 1;
  let pendingWheel: WheelEvent | null = null;

  svg.style.background = GRID_BACKGROUND;

  function write(): void {
    group.setAttribute("transform", `translate(${translate[0]},${translate[1]}) scale(${scale})`);
    svg.style.backgroundPosition = `${translate[0] + GRID_OFFSET_X}px ${translate[1] + GRID_OFFSET_Y}px`;
  }

  let frame = false;
  function schedule(): void {
    if (frame)
      return;
    frame = true;
    requestAnimationFrame(() => {
      frame = false;
      if (pendingWheel !== null) {
        // Single layout read per frame, before any writes.
        const rect = svg.getBoundingClientRect();
        const px = pendingWheel.clientX - rect.left;
        const py = pendingWheel.clientY - rect.top;
        const next = clamp(scale * pendingZoom, minScale, maxScale);
        translate[0] = px - (px - translate[0]) * (next / scale);
        translate[1] = py - (py - translate[1]) * (next / scale);
        scale = next;
      }
      pendingZoom = 1;
      pendingWheel = null;
      write();
    });
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    pendingZoom *= e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    pendingWheel = e;
    schedule();
  }

  function onDown(e: MouseEvent): void {
    panning = true;
    last = [e.clientX, e.clientY];
  }

  function onMove(e: MouseEvent): void {
    if (!panning)
      return;
    translate[0] += e.clientX - last[0];
    translate[1] += e.clientY - last[1];
    last = [e.clientX, e.clientY];
    schedule();
  }

  function onUp(): void {
    panning = false;
  }

  svg.addEventListener("wheel", onWheel, {passive: false});
  svg.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  function fit(width: number, height: number, fitOptions: {padding?: number, maxScale?: number, offsetY?: number} = {}): void {
    const padding = fitOptions.padding ?? 40;
    // Cap the computed scale so fitting small content never over-zooms it.
    const maxFitScale = fitOptions.maxScale ?? 1.5;
    const rect = svg.getBoundingClientRect();
    const raw = Math.min(
      (rect.width - padding) / Math.max(width, 1),
      (rect.height - padding) / Math.max(height, 1),
    );
    scale = clamp(raw, minScale, maxFitScale);
    translate[0] = (rect.width - width * scale) / 2;
    translate[1] = fitOptions.offsetY ?? 24;
    write();
  }

  function reset(): void {
    scale = 1;
    translate = [0, 0];
    write();
  }

  function unmount(): void {
    svg.removeEventListener("wheel", onWheel);
    svg.removeEventListener("mousedown", onDown);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  return {
    get scale(): number { return scale; },
    get translate(): [number, number] {
      return translate;
    },
    fit,
    reset,
    unmount,
  };
}
