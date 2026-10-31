import * as t from "@/types.ts";
import {hashmod} from "@/shared.ts";
import {foreignObject, m, s} from "../../lib/utils.ts";
import {css} from "../../lib/styles.ts";
import {dark as cDark, white as cWhite} from "../../lib/theme.ts";
import PanZoom from "../../components/panzoom.ts";

// Plan diagram: draws the unified query plan (SQLPlan) as a top-down SVG tree
// — operators as nodes, parent->child data flow as edges. Pan with drag, zoom
// with the wheel; clicking a node toggles it between collapsed (title + table)
// and expanded, with index, metrics and details rendered inside the node box
// below a separator. Expansion is per node and independent — toggling one node
// leaves the others expanded. Expanded nodes widen to fit their content (at
// least EXPANDED_W) and return to NODE_W when collapsed; only the details text
// scrolls, capped at DETAILS_MAX_H.

const NODE_W = 150;
const NODE_H = 44;
const H_GAP = 36;
const V_GAP = 64;
const DETAILS_MAX_H = 120;
const EXPANDED_W = Math.round(NODE_W * 1.5);

// Stable per-table hue, same trick as SchemaCanvas.
function hashColor(str: string): string {
  const hue = hashmod(str, 360);
  return `hsl(${hue}, 60%, 55%)`;
}

type Placed = {
  n: t.SQLPlanNode,
  id: number,
  x: number, // left
  y: number, // top
  w: number, // full node width (expanded nodes widen to their content)
  h: number, // full node height: header + expanded body, when expanded
  parent?: number,
};

// Tidy-ish tree layout: leaves get consecutive horizontal slots, parents are
// centered over their children. Two passes: subtree widths, then positions.
// Expanded nodes are wider and taller than the header; each row's tallest
// extra pushes all rows below down, and a leaf's own width widens its slot,
// so expansion never overlaps neighbouring nodes.
export function layoutPlan(plan: t.SQLPlan, sizeOf: (n: t.SQLPlanNode) => {w: number, h: number}): {nodes: Placed[], width: number, height: number} {
  const nodes: Placed[] = [];
  let nextId = 0;

  const rowExtra: number[] = [];
  const collectRowExtras = (n: t.SQLPlanNode, depth: number): void => {
    rowExtra[depth] = Math.max(rowExtra[depth] ?? 0, sizeOf(n).h - NODE_H);
    for (const child of n.children)
      collectRowExtras(child, depth + 1);
  };
  collectRowExtras(plan.root, 0);
  const rowY: number[] = [];
  let rowTop = 0;
  for (let depth = 0; depth < rowExtra.length; depth++) {
    rowY.push(rowTop);
    rowTop += NODE_H + V_GAP + rowExtra[depth];
  }

  const widths = new Map<t.SQLPlanNode, number>();
  function widthOf(n: t.SQLPlanNode): number {
    const cached = widths.get(n);
    if (cached !== undefined)
      return cached;
    const own = sizeOf(n).w;
    const w = n.children.length === 0
      ? own
      : Math.max(own, n.children.map(widthOf).reduce((a, b) => a + b, 0) + H_GAP * (n.children.length - 1));
    widths.set(n, w);
    return w;
  }

  function place(n: t.SQLPlanNode, depth: number, parent: number | undefined, slotLeft: number, slotWidth: number): {centerX: number} {
    const id = nextId++;
    const y = rowY[depth];
    let centerX: number;
    if (n.children.length === 0) {
      centerX = slotLeft + slotWidth / 2;
    } else {
      let childLeft = slotLeft;
      const centers: number[] = [];
      for (const child of n.children) {
        centers.push(place(child, depth + 1, id, childLeft, widthOf(child)).centerX);
        childLeft += widthOf(child) + H_GAP;
      }
      centerX = (centers[0] + centers[centers.length - 1]) / 2;
    }
    const {w, h} = sizeOf(n);
    nodes.push({n, id, x: centerX - w / 2, y, w, h, parent});
    return {centerX};
  }

  const rootWidth = widthOf(plan.root);
  place(plan.root, 0, undefined, 0, rootWidth);
  return {
    nodes,
    width: rootWidth,
    height: rowTop - V_GAP,
  };
}

// Expanded node body, hosted in a foreignObject filling the node rect below
// the header texts; the border-top separates it from the header. Width is set
// inline per node (see the measurement in render).
const nodeBodyClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  boxSizing: "border-box",
  padding: "6px 8px 8px",
  borderTop: "1px solid var(--color-dark-4)",
  fontSize: "11px",
  lineHeight: "1.45",
  cursor: "default",
});
const nodeMutedClass = css({color: "var(--color-dimmed)"});
// Metric rows packed tighter than the body gap, so several metrics read as
// one block.
const nodeMetricsClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  lineHeight: "1.25",
});
const nodeRowClass = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
});
// Scroll cap applies to the details text only; index/metrics grow the node.
const nodeScrollClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  maxHeight: `${DETAILS_MAX_H}px`,
  overflow: "auto",
});
const nodeListClass = css({
  margin: "0",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontFamily: "monospace",
  fontSize: "11px",
  color: "var(--color-text)",
});
const canvasClass = css({
  position: "relative",
  flex: "1",
  minWidth: "0",
  height: "100%",
});

export default function PlanDiagram(el: HTMLElement): {
  el: HTMLElement,
  loaded: (plan: t.SQLPlan) => void,
  fit: () => void,
  unmount: () => void,
} {
  // Node identity is stable across re-renders of one plan, so expansion
  // state, detail scroll positions and measured node sizes key on node
  // objects. Sizes depend only on the node's immutable content, so they are
  // measured once per plan: the probe reads (offsetWidth/offsetHeight) force
  // full document layouts, and re-measuring on every toggle would thrash.
  const expanded = new Set<t.SQLPlanNode>();
  const scrollTops = new Map<t.SQLPlanNode, number>();
  const sizeCache = new Map<t.SQLPlanNode, {w: number, h: number}>();
  let currentPlan: t.SQLPlan | null = null;
  let content: {width: number, height: number} | null = null;

  const nodesGroup = s("g", {id: "plan-nodes"});
  const edgesGroup = s("g", {id: "plan-edges"});
  const mainGroup = s("g", {id: "plan-main"}, edgesGroup, nodesGroup);
  const svg = s("svg", {width: "100%", height: "100%"}, mainGroup);
  const panzoom = PanZoom(svg, mainGroup, {minScale: 0.2, maxScale: 2.5});
  // Off-flow probe: expanded bodies are measured here (visibility:hidden keeps
  // layout working) before the layout pass, so rows below an expanded node
  // reserve the right space. Lives inside canvas so pane re-mounts keep it.
  const measurer = m("div", {style: {position: "absolute", top: "0", left: "0", visibility: "hidden", pointerEvents: "none"}});
  // Reset (and tab re-entry) restore the initial fitted view, not the raw
  // scale-1 origin: plan content is drawn around the layout origin, so only
  // the fit transform places it in view.
  function fit(): void {
    if (content !== null)
      panzoom.fit(content.width, content.height);
  }

  const resetButton = m("button", {
    style: {
      position: "absolute",
      top: "10px",
      right: "10px",
      background: "var(--color-dark-4)",
      color: "var(--color-bright)",
      border: "1px solid var(--color-dark-2)",
      padding: "5px 10px",
      cursor: "pointer",
    },
    onclick: () => {
      fit();
    },
  }, "Reset");
  const canvas = m("div", {class: canvasClass}, svg, measurer, resetButton);
  el.append(canvas);

  function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max - 1) + "…";
  }

  function buildBody(n: t.SQLPlanNode): {body: HTMLElement, scroll: HTMLDivElement | null} {
    let scroll: HTMLDivElement | null = null;
    const parts: HTMLElement[] = [];
    if (n.index !== undefined)
      parts.push(m("div", {},
        m("span", {class: nodeMutedClass}, "index: "),
        m("span", {}, n.index)));
    const metricEntries = Object.entries(n.metrics)
      .toSorted(([n1, _v1], [n2, _v2]) => n1.localeCompare(n2));
    if (metricEntries.length > 0)
      parts.push(m("div", {class: nodeMetricsClass},
        ...metricEntries.map(([name, value]) => m("div", {class: nodeRowClass},
          m("span", {class: nodeMutedClass}, name),
          m("span", {}, value)))));
    if (n.details.length > 0) {
      scroll = m("div", {class: nodeScrollClass},
        ...n.details.map(d => m("pre", {class: nodeListClass}, d)));
      const div = scroll;
      div.addEventListener("scroll", () => scrollTops.set(n, div.scrollTop));
      parts.push(div);
    }
    const body = m("div", {class: nodeBodyClass}, ...parts);
    // The body lives inside the zoomable group: wheel/drag over it must not
    // pan or zoom (scrolling details would be hijacked), and clicks inside it
    // must not collapse the node.
    body.addEventListener("mousedown", e => e.stopPropagation());
    body.addEventListener("wheel", e => e.stopPropagation());
    body.addEventListener("click", e => e.stopPropagation());
    return {body, scroll};
  }

  function render(): void {
    if (currentPlan === null)
      return;
    const bodies = new Map<t.SQLPlanNode, HTMLElement>();
    const scrolls = new Map<t.SQLPlanNode, HTMLDivElement>();
    const probe = (n: t.SQLPlanNode): {n: t.SQLPlanNode, body: HTMLElement, scroll: HTMLDivElement | null} => {
      const {body, scroll} = buildBody(n);
      bodies.set(n, body);
      if (scroll !== null)
        scrolls.set(n, scroll);
      return {n, body, scroll};
    };
    // Measure only nodes without a cached size, and keep all writes ahead of
    // all reads (two layout passes total): a write/read interleave would
    // force one full document layout per read.
    const probes = [...expanded].filter(n => !sizeCache.has(n)).map(probe);
    if (probes.length > 0) {
      measurer.replaceChildren(...probes.map(p => p.body));
      for (const p of probes) {
        if (p.scroll !== null)
          p.scroll.style.width = "0";
        p.body.style.width = "max-content";
      }
      // Width first, with the details text zeroed out: details wrap to
      // whatever width the node gets and must not drive it, while index and
      // metric rows define it so names like "actual time" never wrap.
      const widths = probes.map(p => Math.max(EXPANDED_W, p.body.offsetWidth));
      for (const [i, p] of probes.entries()) {
        p.body.style.width = `${widths[i]}px`;
        if (p.scroll !== null)
          p.scroll.style.width = "";
      }
      for (const [i, p] of probes.entries())
        sizeCache.set(p.n, {w: widths[i], h: NODE_H + Math.max(p.body.offsetHeight, 1)});
      measurer.replaceChildren();
    }
    for (const n of expanded) {
      if (!bodies.has(n))
        probe(n);
    }

    // Collapsed nodes keep the header size even with a cached expanded size.
    const sizeOf = (n: t.SQLPlanNode): {w: number, h: number} =>
      expanded.has(n) ? sizeCache.get(n) ?? {w: NODE_W, h: NODE_H} : {w: NODE_W, h: NODE_H};
    const {nodes, width, height} = layoutPlan(currentPlan, sizeOf);
    const byId = new Map(nodes.map(p => [p.id, p]));
    edgesGroup.replaceChildren(...nodes.filter((p): p is Placed & {parent: number} => p.parent !== undefined).map(p => {
      const parent = byId.get(p.parent)!;
      const x1 = parent.x + parent.w / 2;
      const y1 = parent.y + parent.h;
      const x2 = p.x + p.w / 2;
      const y2 = p.y;
      const bend = (y2 - y1) / 2;
      return s("path", {
        d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
        fill: "none",
        stroke: cDark[3],
        "stroke-width": 1.5,
      });
    }));
    nodesGroup.replaceChildren(...nodes.map(p => {
      const isExpanded = expanded.has(p.n);
      const rect = s("rect", {
        x: String(p.x),
        y: String(p.y),
        width: String(p.w),
        height: String(p.h),
        rx: "6",
        fill: cDark[6],
        stroke: isExpanded ? cWhite : cDark[2],
        "stroke-width": isExpanded ? 2 : 1.5,
      });
      const g = s("g", {style: {cursor: "pointer"}},
        rect,
        s("text", {
          x: String(p.x + p.w / 2),
          y: String(p.y + (p.n.table === undefined ? NODE_H / 2 + 4 : 18)),
          "text-anchor": "middle",
          fill: cWhite,
          "font-size": "12",
          "font-family": "monospace",
        }, truncate(p.n.title, 20)),
        p.n.table !== undefined ? s("text", {
          x: String(p.x + p.w / 2),
          y: String(p.y + 34),
          "text-anchor": "middle",
          fill: hashColor(p.n.table),
          "font-size": "11",
          "font-family": "monospace",
        }, truncate(p.n.alias !== undefined ? `${p.n.table} as ${p.n.alias}` : p.n.table, 22)) : null,
      );
      if (isExpanded)
        g.append(foreignObject(p.x, p.y + NODE_H, p.w, p.h - NODE_H, bodies.get(p.n)!));
      g.addEventListener("click", e => {
        e.stopPropagation();
        if (expanded.has(p.n))
          expanded.delete(p.n);
        else
          expanded.add(p.n);
        render();
      });
      return g;
    }));
    // Re-render rebuilds the bodies, so restore detail scroll positions.
    for (const [n, div] of scrolls)
      div.scrollTop = scrollTops.get(n) ?? 0;
    content = {width, height};
  }

  return {
    el: canvas,
    loaded: (plan: t.SQLPlan): void => {
      // Node identity comes from the plan tree: a new plan invalidates
      // expansion, scroll and size state.
      currentPlan = plan;
      expanded.clear();
      scrollTops.clear();
      sizeCache.clear();
      render();
      fit();
    },
    fit,
    unmount: (): void => panzoom.unmount(),
  };
}
