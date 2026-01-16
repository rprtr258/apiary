import {getBoxToBoxArrow} from "perfect-arrows";
import {database} from "../../wailsjs/go/models.ts";
import {m, s} from "../utils.ts";

export function range(start: number, end: number): number[] {
  if (start >= end) return [];
  return Array.from({length: end - start}, (_, i) => i + start);
}

type SchemaData = {name: string, schema: database.TableSchema}[];

function parseColumns(definition: string): string[] {
  const match = definition.match(/\(([^)]+)\)/);
  if (match === null)
    return [];
  return match[1].split(",").map(part => part.trim());
}

function hashColor(str: string): string {
  const hash = [...str].map(c => c.charCodeAt(0)).reduce((h, c) => c + (h << 5) - h, 0);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

function getColumnConstraints(table: {name: string, schema: database.TableSchema}): Record<string, string[]> {
  const constraints = Object.fromEntries(table.schema.columns.map(col => [col.name, [] as string[]]));
  for (const constraint of table.schema.constraints) {
    const cols = parseColumns(constraint.definition);
    for (const col of cols) {
      constraints[col].push(constraint.type);
    }
  }
  return constraints;
}

// shared definitions, hence defined once globally
if (document.getElementById("schema-canvas-defs") === null) {
  document.body.append(s("svg", {
    id: "schema-canvas-defs",
    width: "0",
    height: "0",
    style: {position: "absolute"},
  }, s("defs", {},
    // Arrow marker
    s("marker", {
      id: "arrowhead",
      markerWidth: "10",
      markerHeight: "7",
      refX: "9",
      refY: "3.5",
      orient: "auto",
    }, s("polygon", {
        points: "0 0, 10 3.5, 0 7",
        fill: "#888888",
      })),
    s("pattern", {
        id: "pattern-hero",
        x: "7",
        y: "-5",
        width: "40",
        height: "40",
        patternUnits: "userSpaceOnUse",
        patternTransform: "translate(-11,-11)",
      },
        s("circle", {
          cx: "20",
          cy: "20",
          r: "2",
          fill: "#343434",
        })))));
}

const PADDING = 5;
const ROW_HEIGHT = 20;
const CHAR_WIDTH = 8;
const CELL_PADDING = 10;
const TABLE_SPACING = 50;
const TABLE_GRID_COLS = 7;
const ARROW_PAD_END = 0;
const ARROW_BOW = 3;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_FACTOR_IN = 0.9;
const ZOOM_FACTOR_OUT = 1.1;

function calculateColumnWidths(table: {name: string, schema: database.TableSchema}): [number, number] {
  const columns = table.schema.columns;
  const maxNameLen = Math.max(
    table.name.length / 2,
    ...columns.map(col => col.name.length),
  );
  const maxTypeLen = Math.max(
    table.name.length / 2,
    ...columns.map(col => col.type.length),
  );
  return [maxNameLen * CHAR_WIDTH + CELL_PADDING, maxTypeLen * CHAR_WIDTH + CELL_PADDING];
}

function calculateTableDimensions(numRows: number, colWidths: [number, number]): {width: number, height: number} {
  const height = numRows * ROW_HEIGHT + CELL_PADDING;
  const width = colWidths.reduce((a, b) => a + b) + CELL_PADDING;
  return {width, height};
}

function calculateTablePosition(index: number, width: number, height: number): {x: number, y: number} {
  const x = (index % TABLE_GRID_COLS) * (width + TABLE_SPACING) + TABLE_SPACING;
  const y = Math.floor(index / TABLE_GRID_COLS) * (height + TABLE_SPACING) + TABLE_SPACING;
  return {x, y};
}

export default function SchemaCanvas(el: HTMLElement): {loaded: (data: SchemaData) => void} {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let draggedNode: SVGGElement | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let selectionDisabled = false;
  let tablePositions: Record<string, {x: number, y: number, width: number, height: number}> = {};
  let tableIdMap: Record<string, string> = {};
  let currentData: SchemaData | null = null;

  const nodesGroup: SVGGElement = s("g", {id: "nodes"});
  const edgesGroup: SVGGElement = s("g", {id: "edges"});
  const mainGroup: SVGGElement = s("g", {id: "main"}, nodesGroup, edgesGroup);

  const bg = s("rect", {
    x: "0",
    y: "0",
    width: "100%",
    height: "100%",
    fill: "url(#pattern-hero)",
    style: {pointerEvents: "none"},
  });

  const svg = s("svg", {
    width: "100%",
    height: "100%",
    style: {background: "#2a2a2a"},
  }, bg, mainGroup);

  function updateTransform() {
    mainGroup.setAttribute("transform", `translate(${translateX},${translateY}) scale(${scale})`);
  }

  function drawArrows(tables: SchemaData) {
    edgesGroup.replaceChildren(...tables.flatMap(table =>
      table.schema.foreign_keys.map(fk => {
        const sourceTable = table;
        const targetTable = tables.find(t => t.name === fk.table);
        if (targetTable === undefined) return undefined;
        const sourceColIndex = sourceTable.schema.columns.findIndex(c => c.name === fk.column);
        const targetColIndex = targetTable.schema.columns.findIndex(c => c.name === fk.to);
        if (sourceColIndex === -1 || targetColIndex === -1) return undefined;
        if (!(sourceTable.name in tableIdMap) || !(targetTable.name in tableIdMap)) return undefined;
        const sourceId = tableIdMap[sourceTable.name];
        const targetId = tableIdMap[targetTable.name];
        const sourcePos = tablePositions[sourceId];
        const targetPos = tablePositions[targetId];
        const [sx, sy, cx, cy, ex, ey] = getBoxToBoxArrow(
          sourcePos.x + PADDING, sourcePos.y + (sourceColIndex + 1) * ROW_HEIGHT + PADDING,
          sourcePos.width - 2 * PADDING, ROW_HEIGHT,
          targetPos.x + PADDING, targetPos.y + (targetColIndex + 1) * ROW_HEIGHT + PADDING,
          targetPos.width - 2 * PADDING, ROW_HEIGHT,
          {padEnd: ARROW_PAD_END, bow: ARROW_BOW},
        );
        const line = s("path", {
          d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`,
          stroke: "#888888",
          fill: "none",
          "stroke-width": 2,
          "marker-end": "url(#arrowhead)",
        });
        return line;
      }).filter(n => n !== undefined),
    ));
  }

  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const point = svg.createSVGPoint();
    point.x = e.clientX - rect.left;
    point.y = e.clientY - rect.top;
    const transformedX = (point.x - translateX) / scale;
    const transformedY = (point.y - translateY) / scale;
    const delta = e.deltaY > 0 ? ZOOM_FACTOR_IN : ZOOM_FACTOR_OUT;
    scale *= delta;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    translateX = point.x - transformedX * scale;
    translateY = point.y - transformedY * scale;
    updateTransform();
  });
  svg.addEventListener("mousedown", e => {
    if (e.target === svg || e.target === mainGroup) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  svg.addEventListener("mousemove", e => {
    if (isDragging) {
      translateX += e.clientX - lastX;
      translateY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      updateTransform();
    }
    if (draggedNode !== null) {
      if (!selectionDisabled) {
        const texts = draggedNode.querySelectorAll("text");
        for (const text of texts)
          text.style.userSelect = "none";
        selectionDisabled = true;
      }
      const rect = svg.getBoundingClientRect();
      let pt = svg.createSVGPoint();
      pt.x = e.clientX - rect.left;
      pt.y = e.clientY - rect.top;
      const ctm = mainGroup.getCTM()!;
      pt = pt.matrixTransform(ctm.inverse());
      const x = pt.x - dragOffsetX;
      const y = pt.y - dragOffsetY;
      draggedNode.setAttribute("transform", `translate(${x},${y})`);
        // Update position for edge recalculation
        const tableId = draggedNode.getAttribute("data-id")!;
        tablePositions[tableId].x = x;
        tablePositions[tableId].y = y;
        if (currentData !== null) drawArrows(currentData);
    }
  });
  svg.addEventListener("mouseup", _e => {
    isDragging = false;
    if (draggedNode !== null) {
      const texts = draggedNode.querySelectorAll("text");
      for (const text of texts)
        text.style.userSelect = "";
      selectionDisabled = false;
    }
    draggedNode = null;
  });

  nodesGroup.addEventListener("mousedown", e => {
    const target = e.target as Element;
    const node: SVGGElement | null = target.closest(".node");
    if (node === null) {
      return;
    }

    draggedNode = node;
    selectionDisabled = false;
    const rect = svg.getBoundingClientRect();
    let pt = svg.createSVGPoint();
    pt.x = e.clientX - rect.left;
    pt.y = e.clientY - rect.top;
    const ctm = mainGroup.getCTM()!;
    pt = pt.matrixTransform(ctm.inverse());
    const transformList = node.transform.baseVal;
    let currentX = 0;
    let currentY = 0;
    if (transformList.numberOfItems > 0 && transformList.getItem(0).type === SVGTransform.SVG_TRANSFORM_TRANSLATE) {
      const translateTransform = transformList.getItem(0);
      currentX = translateTransform.matrix.e;
      currentY = translateTransform.matrix.f;
    }
    dragOffsetX = pt.x - currentX;
    dragOffsetY = pt.y - currentY;
    e.stopPropagation();
  });

  const resetButton = m("button", {
    style: {
      position: "absolute",
      top: "10px",
      right: "10px",
      background: "#555",
      color: "#fff",
      border: "1px solid #777",
      padding: "5px 10px",
      cursor: "pointer",
    },
    onclick: () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    },
  }, "Reset");
  el.append(svg, resetButton);

  return {
    loaded: (tables: SchemaData) => {
      currentData = tables;
      tablePositions = {};
      tableIdMap = {};
      nodesGroup.replaceChildren(...tables.entries().map(([index, table]) => {
        const tableId = `table-${index}`;
        tableIdMap[table.name] = tableId;
        const colConstraints = getColumnConstraints(table);
        const colWidths = calculateColumnWidths(table);
        const numRows = 1 + table.schema.columns.length;
        const dimensions = calculateTableDimensions(numRows, colWidths);
        const position = calculateTablePosition(index, dimensions.width, dimensions.height);
        const {width, height} = dimensions;
        const {x, y} = position;

        tablePositions[tableId] = {x, y, width, height};

        // Prepare text without borders
        const tableText = table.name;

        // Rect
        const nodeBg = hashColor(table.name);
        const rect = s("rect", {
          width: width.toString(),
          height: height.toString(),
          fill: nodeBg,
          stroke: "#555555",
          "stroke-width": 1,
          rx: "5",
        });

        // Draw table grid and text
        let yPos = PADDING;
        // Header row background
        const headerBg = s("rect", {
          x: PADDING.toString(),
          y: yPos.toString(),
          width: colWidths.reduce((a, b) => a + b).toString(),
          height: ROW_HEIGHT.toString(),
          fill: nodeBg,
        });

        // Header text
        const headerText = s("text", {
          x: (PADDING + colWidths.reduce((a, b) => a + b) / 2).toString(),
          y: (yPos + 15).toString(),
          fill: "#ffffff",
          "font-family": "monospace",
          "font-size": "10px",
          "text-anchor": "middle",
        });
        headerText.textContent = tableText;

        const node = s("g", {class: "node", transform: `translate(${x},${y})`}, rect, headerBg, headerText);
        node.setAttribute("data-id", tableId);
        yPos += ROW_HEIGHT;

        // Data rows
        for (const col of table.schema.columns) {
          const cons = colConstraints[col.name];

          const iconsMap: Record<string, string> = {
            "PRIMARY KEY": " 🔑",
            "UNIQUE": " ❗",
            "CHECK": " ❓",
          };
          const icon = Object.entries(iconsMap).find(([key]) => cons.includes(key))?.[1] ?? "  ";

          // Row background
          node.appendChild(s("rect", {
            x: PADDING.toString(),
            y: yPos.toString(),
            width: colWidths.reduce((a, b) => a + b).toString(),
            height: ROW_HEIGHT.toString(),
            fill: "#333333",
          }));

          const texts = [col.name + icon, col.type];
          let xPos = PADDING;
          for (const [colIdx, txt] of texts.entries()) {
            const cellText = s("text", {
              x: (xPos + colWidths[colIdx] / 2).toString(),
              y: (yPos + 15).toString(),
              fill: "#ffffff",
              "font-family": "monospace",
              "font-size": "10px",
              "text-anchor": "middle",
            });
            cellText.textContent = txt;
            node.appendChild(cellText);
            xPos += colWidths[colIdx];
          }
          yPos += ROW_HEIGHT;
        }

        const y1 = PADDING + ROW_HEIGHT;
        const y2 = PADDING + numRows * ROW_HEIGHT;
        const xPositions = [PADDING, PADDING + colWidths[0], PADDING + colWidths[0] + colWidths[1]];
        // Draw grid lines
        node.append(...[
          // horizontal
          ...range(1, numRows+1).map(r => {
            const currentY = PADDING + r * ROW_HEIGHT;
            return s("line", {
              x1: PADDING,
              y1: currentY,
              x2: PADDING + colWidths.reduce((a, b) => a + b),
              y2: currentY,
              stroke: "#555555",
              "stroke-width": 1,
            });
          }),
          // vertical
          ...xPositions.map(x => s("line", {
            x1: x,
            y1: y1,
            x2: x,
            y2: y2,
            stroke: "#555555",
            "stroke-width": 1,
          })),
        ]);

        return node;
      }));

      drawArrows(tables);
    },
  };
}