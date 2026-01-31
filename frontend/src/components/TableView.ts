import {ComponentContainer} from "golden-layout";
import {database} from "../../wailsjs/go/models.ts";
import {api} from "../api.ts";
import {clamp, DOMNode, m, signal} from "../utils.ts";
import {css} from "../styles.ts";
import notification from "../notification.ts";
import {RowValue} from "../types.ts";
import {NButton} from "./input.ts";
import {NScrollbar, NTabs} from "./layout.ts";
import {NIcon} from "./dataview.ts";
import {CheckSquareOutlined, ClockCircleOutlined, FieldNumberOutlined, ItalicOutlined, QuestionCircleOutlined} from "./icons.ts";
import {none, Option, some} from "../option.ts";

function render(v: RowValue): DOMNode {
  switch (true) {
  case v === null:
    return m("span", {style: {color: "grey"}}, "(NULL)");
  case typeof v === "boolean":
    return v ? "✅" : "❌";
  case typeof v === "number":
    return m("span", {style: {color: "#e84e40"}}, String(v));
  case typeof v === "string":
    return v;
  default:
    notification.error({title: "unknown row value type", "typestr": String(v), "type": typeof v});
    return String(v);
  }
}

function render_column(c: string, typ: string) {
  return m("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: "0.5em",
      overflow: "clip",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      cursor: "default",
      padding: "3px 5px",
    },
    title: `${c} : ${typ}`,
  },
    c,
    m("div", {}, NIcon({
      size: 15,
      color: "grey",
      component:
        typ === "number" ? FieldNumberOutlined :
        typ === "string" ? ItalicOutlined :
        typ === "bool" ? CheckSquareOutlined :
        typ === "time" ? ClockCircleOutlined :
          QuestionCircleOutlined,
    })),
  );
}

type DataTableProps = {
  columns: string[],
  types: string[],
  rows: RowValue[][],
};

const split_styles = {
  default: css(`
    background-color: transparent;
  `),
  selected: css(`
    background-color: mediumblue;
  `),
};

export function DataTable() {
  const el_table = m("div", {
    style: {
      display: "grid",
    },
    "data-testid": "data-container",
  });
  const el = m("div", {
    style: {
      height: "100%",
      overflow: "auto",
    },
  }, el_table);

  let columnWidths: number[] = [];
  let resizingColumnIndex: Option<number> = none;
  let startX = 0;
  let startWidth = 0;
  let resizeHandles: HTMLElement[] = [];

  function setHighlight(handle: HTMLElement, on: boolean): void {
    handle.classList.toggle(split_styles.default, !on);
    handle.classList.toggle(split_styles.selected, on);
  }

  function handleMouseMove(e: MouseEvent) {
    if (resizingColumnIndex.isNone()) return;

    const delta = e.clientX - startX;
    columnWidths[resizingColumnIndex.value] = Math.max(50, startWidth + delta);

    updateColumnWidths();
  }

  function handleMouseUp() {
    for (const handle of resizeHandles)
      setHighlight(handle, false);

    resizingColumnIndex = none;

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  function updateColumnWidths() {
    el_table.style.gridTemplateColumns = columnWidths.flatMap(w => [w, 5]).map(w => `${w}px`).join(" ");
  }

  return {
    el,
    update({columns, rows, types}: DataTableProps) {
      if (columnWidths.length !== columns.length) {
        columnWidths = columns.map((c, i) => clamp(
          Math.max(
            c.length*12,
            Math.max(...rows.map(r => String(r[i]).length))*10,
          ),
          50,
          200,
        ));
        resizeHandles = columnWidths.map((_, i) => {
          const handle = m("div", {
            style: {
              width: "5px",
              cursor: "col-resize",
              pointerEvents: "auto",
            },
            class: split_styles.default,
            onmousedown: (e: MouseEvent) => {
              e.preventDefault();

              resizingColumnIndex = some(i);
              startX = e.clientX;
              startWidth = columnWidths[i];

              document.addEventListener("mousemove", handleMouseMove);
              document.addEventListener("mouseup", handleMouseUp);
            },
            onmouseenter: () => {
              if (resizingColumnIndex.isNone())
                return;
              setHighlight(handle, true);
            },
            onmouseleave: () => {
              if (resizingColumnIndex.isSome())
                return;
              setHighlight(handle, false);
            },
          });
          return handle;
        });
      }

      for (const handle of resizeHandles)
        handle.style.gridRowStart = `span ${rows.length+1}`;

      el_table.replaceChildren(
        ...columns.flatMap((c, i) => [render_column(c, types[i]), resizeHandles[i]]),
        ...rows.flatMap((r, j) => columns.map((_, i) =>
          m("td", {
            style: {
              cursor: "default",
              fontSize: "12pt",
              padding: "3px 5px",
              overflow: "clip",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              backgroundColor: j % 2 === 0 ? "var(--row-even)" : "",
            },
          }, render(r[i])))),
      );

      updateColumnWidths();
    },
  };
}

const pageSize = 100;

type Props = {
  sqlSourceID: string,
  tableName: string,
  tableInfo: database.TableInfo,
};

export default function(
  container: ComponentContainer,
  {sqlSourceID, tableName, tableInfo}: Props,
) {
  const el: HTMLElement = container.element;
  el.replaceChildren(m("div", {class: "h100"}, "Loading table viewer..."));

  const dataTable = DataTable();
  const schemaTable = DataTable();
  const indexesTable = DataTable();
  const constraintsTable = DataTable();
  const loading = signal(false);
  const currentPage = signal(0);
  const totalRows = signal(tableInfo.rowCount);

  const prevDisabled = () => currentPage.value === 0;
  const nextDisabled = () => (currentPage.value + 1) * pageSize >= totalRows.value;
  const showingRows = () => {
    const start = totalRows.value === 0 ? 0 : currentPage.value * pageSize + 1;
    const end = Math.min(start + pageSize - 1, totalRows.value);
    return `Showing rows ${start}-${end} of ${totalRows.value}`;
  };

  const prevButton = NButton({
    on: {click: () => { currentPage.update(v => Math.max(0, v - 1)); loadData(currentPage.value); }},
    disabled: prevDisabled(),
  }, "Previous");
  const nextButton = NButton({
    on: {click: () => { currentPage.update(v => v + 1); loadData(currentPage.value); }},
    disabled: nextDisabled(),
  }, "Next");
  const infoSpan = m("span", {}, showingRows());

  async function loadData(page: number) {
    loading.update(() => true);
    const offset = page * pageSize;
    const query = `SELECT * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`;
    const res = await api.requestPerformSQLSource(sqlSourceID, query);
    loading.update(() => false);
    if (res.kind === "ok") {
      const response = res.value.response as database.SQLResponse;
      dataTable.update({
        columns: response.columns,
        types: response.types,
        rows: response.rows as RowValue[][],
      });
    } else {
      // Handle error
      notification.error({title: "Could not load data", error: res.value});
      dataTable.update({columns: [], rows: [], types: []});
    }
    // Update UI elements
    prevButton.disabled = prevDisabled();
    nextButton.disabled = nextDisabled();
    infoSpan.textContent = showingRows();
  }

  async function loadSchema() {
    const res = await api.requestDescribeTableSQLSource(sqlSourceID, tableName);
    if (res.kind === "err") {
      notification.error({title: "Could not describe table", error: res.value});
      return;
    }

    const {columns, indexes, constraints} = res.value;
    // Schema (columns)
    schemaTable.update({
      columns: ["Name", "Type", "Nullable", "Default"],
      types: ["string", "string", "bool", "string"],
      rows: columns.map(col => [col.name, col.type, col.nullable, col.defaultValue]) as RowValue[][],
    });
    // Indexes
    indexesTable.update({
      columns: ["Name", "Definition"],
      types: ["string", "string"],
      rows: indexes.map(idx => [idx.name, idx.definition]) as RowValue[][],
    });
    // Constraints
    constraintsTable.update({
      columns: ["Name", "Type", "Definition"],
      types: ["string", "string", "string"],
      rows: constraints.map(con => [con.name, con.type, con.definition]) as RowValue[][],
    });
  }

  // Initial load
  loadData(0);
  loadSchema();

  const dataTab = m("div", {class: "h100", style: {display: "flex", flexDirection: "column"}},
    m("div", {style: {display: "flex", gap: "1em", alignItems: "center"}},
      prevButton.el,
      infoSpan,
      nextButton.el,
    ),
    NScrollbar(dataTable.el),
  );

  const schemaTab = NScrollbar(schemaTable.el);
  const indexesTab = NScrollbar(indexesTable.el);
  const constraintsTab = NScrollbar(constraintsTable.el);

  const tabs = NTabs({
    tabs: [
      {name: "Data", elem: dataTab},
      {name: "Schema", elem: schemaTab},
      {name: "Indexes", elem: indexesTab},
      {name: "Constraints", elem: constraintsTab},
    ],
  });

  el.replaceChildren(tabs);
}
