import * as t from "@/types.ts";
import {none, Option, some} from "@/option.ts";
import {api} from "../api.ts";
import {clamp, deepEquals, DOMNode, m, setDisplay, signal} from "../lib/utils.ts";
import {css} from "../lib/styles.ts";
import notification from "../lib/notification.ts";
import NButton from "./button.ts";
import {NScrollbar, NTabs} from "./layout.ts";
import TableFilter from "./TableFilter.ts";
import {NIcon} from "./dataview.ts";
import {CheckSquareOutlined, ClockCircleOutlined, FieldNumberOutlined, ItalicOutlined, QuestionCircleOutlined} from "./icons.ts";
import {ComponentContainer} from "../layout/types.ts";

function render(v: t.RowValue): DOMNode {
  switch (true) {
  case v === null:
    return m("span", {style: {color: "var(--color-dimmed)"}}, "(NULL)");
  case typeof v === "boolean":
    return v ? "✅" : "❌";
  case typeof v === "number":
    return m("span", {style: {color: "var(--color-red-6)"}}, String(v));
  case typeof v === "string":
    return v;
  case v instanceof Date:
    return v.toISOString();
  case typeof v === "object":
    return JSON.stringify(v);
  default:
    notification("error", "unknown row value type", {typestr: String(v), type: typeof v, json: JSON.stringify(v)});
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
      color: "var(--color-dimmed)",
      component:
        typ === "number" ? FieldNumberOutlined :
        typ === "string" ? ItalicOutlined :
        typ === "bool" ? CheckSquareOutlined :
        typ === "time" ? ClockCircleOutlined :
          QuestionCircleOutlined,
    })),
  );
}

const column_type_icons: Partial<Record<t.ColumnType, SVGSVGElement>> = {
  [t.ColumnType.NUMBER]: FieldNumberOutlined,
  [t.ColumnType.STRING]: ItalicOutlined,
  [t.ColumnType.BOOLEAN]: CheckSquareOutlined,
  [t.ColumnType.TIME]: ClockCircleOutlined,
  [t.ColumnType.JSON]: QuestionCircleOutlined, // TODO: json icon
  [t.ColumnType.UNKNOWN]: QuestionCircleOutlined,
};

function render_column_with_sort(
  c: string,
  typ: t.ColumnType,
  typename: string,
  sortInfo?: {direction: "asc" | "desc", order: number},
  onSortAdd?: (column: string, direction: "asc" | "desc") => void,
  onSortRemove?: (column: string) => void,
  onSortToggle?: (column: string) => void,
) {
  const isSorted = sortInfo !== undefined;
  const sortDirection = sortInfo?.direction;
  const sortOrder = sortInfo?.order;

  return m("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "0.5em",
      overflow: "clip",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      cursor: "default",
      padding: "3px 5px",
    },
    title: `${c} : ${typename}${isSorted ? ` (Sorted ${sortDirection === "asc" ? "ascending" : "descending"}${sortOrder !== undefined && sortOrder > 1 ? `, priority ${sortOrder}` : ""})` : ""}`,
  },
    m("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "0.3em",
        flex: "1",
        minWidth: "0",
      },
    },
      c,
      m("div", {}, NIcon({
        size: 15,
        color: "var(--color-dimmed)",
        component: column_type_icons[typ] ?? QuestionCircleOutlined,
      })),
    ),
    m("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "0.2em",
        flexShrink: "0",
      },
    },
      sortOrder !== undefined && sortOrder > 1 ? m("span", {
        style: {
          fontSize: "0.7em",
          backgroundColor: "var(--color-blue-light)",
          color: "var(--color-bright)",
          borderRadius: "50%",
          width: "1.2em",
          height: "1.2em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginRight: "0.2em",
        },
        title: `Sort priority: ${sortOrder}`,
      }, sortOrder.toString()) : null,

      // Unified sort button (cycles: none -> asc -> desc -> none)
      m("button", {
        style: {
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.2em",
          fontSize: "0.8em",
          color: isSorted ? "var(--color-blue-6)" : "var(--color-dark-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        title: isSorted
          ? (sortDirection === "asc" ? "Sort descending (Z-A, 9-0)" : "Remove sort")
          : "Sort ascending (A-Z, 0-9)",
        onclick: (e: Event) => {
          e.stopPropagation();
          if (onSortToggle !== undefined) {
            onSortToggle(c);
          } else if (onSortAdd !== undefined && onSortRemove !== undefined) {
            // Fallback for backward compatibility
            if (isSorted) {
              if (sortDirection === "asc") {
                onSortAdd(c, "desc");
              } else {
                onSortRemove(c);
              }
            } else {
              onSortAdd(c, "asc");
            }
          }
        },
      }, sortDirection === "desc" ? "×" : "↑"),
    ),
  );
}

type DataTableProps = {
  columns: string[],
  typenames: string[],
  types: t.ColumnType[],
  rows: t.RowValue[][],
  sortColumns?: {column: string, direction: "asc" | "desc", order: number}[],
  on: {
    sortAdd?: (column: string, direction: "asc" | "desc") => void,
    sortRemove?: (column: string) => void,
    sortToggle?: (column: string) => void,
  },
};

const split_styles = {
  default: css(`
    background-color: transparent;
  `),
  selected: css(`
    background-color: mediumblue;
  `),
};

type EditableConfig = {
  pkColumns: string[],
  nullable: boolean[],
  onEditsChange: (edits: t.CellUpdate[]) => void,
};

const edited_cell_style = css(`
  outline: 2px solid var(--color-yellow-6);
  outline-offset: -2px;
`);
const invalid_cell_style = css(`
  outline: 2px solid var(--color-red-6);
  outline-offset: -2px;
`);
const cell_menu_style = css(`
  position: fixed;
  z-index: 1000;
  background: var(--color-default);
  border: 1px solid var(--color-default-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  min-width: 120px;
`);
const cell_menu_item_style = css(`
  padding: 4px 12px;
  cursor: pointer;
  white-space: nowrap;
`, {
  ":hover": {
    background: "var(--color-dark-5)",
  },
});

// Columns of the table's primary key, in schema column order. MySQL and
// SQLite report one constraint entry per PK column (same name) — entries are
// merged. TODO: ClickHouse — describeTable returns no constraints, so PK
// detection (and table editing) is unavailable for ClickHouse tables.
export function primaryKeyColumns(schema: t.TableSchema): string[] {
  const pkColumns = new Set<string>();
  for (const c of schema.constraints) {
    if (c.type !== "PRIMARY KEY")
      continue;
    for (const col of c.columns)
      pkColumns.add(col);
  }
  return schema.columns.map(c => c.name).filter(name => pkColumns.has(name));
}

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
  let resizeFrame = 0;

  // Editing state (keyed by PK values so it survives pagination/sorting reloads)
  let lastProps: DataTableProps | undefined;
  let editable: EditableConfig | undefined;
  const edits = new Map<string, {pkValues: t.RowValue[], changes: Map<string, t.RowValue>}>();
  const invalid = new Map<string, string>(); // cellKey -> raw input kept for fixing
  let openMenu: HTMLElement | undefined = undefined;

  function setHighlight(handle: HTMLElement, on: boolean): void {
    handle.classList.toggle(split_styles.default, !on);
    handle.classList.toggle(split_styles.selected, on);
  }

  function handleMouseMove(e: MouseEvent) {
    if (resizingColumnIndex.isNone()) return;

    const delta = e.clientX - startX;
    columnWidths[resizingColumnIndex.value] = Math.max(50, startWidth + delta);

    // Coalesce the layout write to one frame.
    if (resizeFrame === 0) {
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        updateColumnWidths();
      });
    }
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

  function rowKeyOf(j: number): string {
    if (editable === undefined || lastProps === undefined)
      return String(j);
    const r = lastProps.rows[j];
    const cols = lastProps.columns;
    return JSON.stringify(editable.pkColumns.map(c => r[cols.indexOf(c)] ?? null));
  }

  function cellKeyOf(j: number, column: string): string {
    return `${rowKeyOf(j)}:${column}`;
  }

  function emitEdits(): void {
    if (editable === undefined)
      return;
    const list: t.CellUpdate[] = [...edits.values()].flatMap(({pkValues, changes}) => [...changes.entries()].map(([column, value]) => ({pkValues, column, value})));
    editable.onEditsChange(list);
  }

  // Records (or clears, when the value matches the original) a cell edit and
  // re-renders the table.
  function applyEdit(j: number, column: string, value: t.RowValue): void {
    if (editable === undefined || lastProps === undefined)
      return;
    const r = lastProps.rows[j];
    const cols = lastProps.columns;
    const originalIndex = cols.indexOf(column);
    const original = originalIndex >= 0 ? r[originalIndex] ?? null : null;
    const key = rowKeyOf(j);
    if (deepEquals(value, original)) {
      const row = edits.get(key);
      row?.changes.delete(column);
      if (row !== undefined && row.changes.size === 0)
        edits.delete(key);
    } else {
      const row = edits.get(key) ?? {pkValues: editable.pkColumns.map(c => r[cols.indexOf(c)] ?? null), changes: new Map()};
      row.changes.set(column, value);
      edits.set(key, row);
    }
    invalid.delete(cellKeyOf(j, column));
    renderTable();
    emitEdits();
  }

  // Empty input is an empty string, not null — NULL is only set explicitly
  // via the context menu. Numbers must parse.
  function parseInput(original: t.RowValue, raw: string): {kind: "ok", value: t.RowValue} | {kind: "invalid"} {
    if (typeof original === "number") {
      const trimmed = raw.trim();
      if (trimmed === "" || Number.isNaN(Number(trimmed)))
        return {kind: "invalid"};
      return {kind: "ok", value: Number(trimmed)};
    }
    return {kind: "ok", value: raw};
  }

  function closeMenu(): void {
    openMenu?.remove();
    openMenu = undefined;
    document.removeEventListener("click", closeMenu);
  }

  function openCellMenu(e: MouseEvent, j: number, i: number): void {
    if (editable === undefined || lastProps === undefined || openMenu !== undefined)
      return;
    if (!editable.nullable[i])
      return;
    e.preventDefault();
    const column = lastProps.columns[i];
    const menu = m("div", {class: cell_menu_style, style: {left: `${e.clientX}px`, top: `${e.clientY}px`}},
      m("div", {
        class: cell_menu_item_style,
        "data-testid": "set-null",
        onclick: () => {
          closeMenu();
          applyEdit(j, column, null);
        },
      }, "Set NULL"),
    );
    openMenu = menu;
    document.body.append(menu);
    document.addEventListener("click", closeMenu);
  }

  // Swaps the cell content for an editor. Boolean columns get a true/false
  // dropdown, everything else a text input.
  function buildEditor(td: HTMLTableCellElement, j: number, i: number, initialRaw: string | undefined, isInvalid: boolean): void {
    if (lastProps === undefined)
      return;
    const column = lastProps.columns[i];
    const original = lastProps.rows[j][i] ?? null;
    const finish = (): void => {
      renderTable();
    };
    const commit = (raw: string): void => {
      const parsed = parseInput(original, raw);
      if (parsed.kind === "invalid") {
        // Abort the commit, keep the typed value: the cell re-renders as a
        // red-outlined input with the same text.
        invalid.set(cellKeyOf(j, column), raw);
        renderTable();
        notification("error", `Invalid value for column "${column}"`, {value: raw});
        return;
      }
      applyEdit(j, column, parsed.value);
    };

    if (lastProps.types[i] === t.ColumnType.BOOLEAN) {
      const select = m("select", {"data-testid": "cell-select", style: {
        width: "100%",
        boxSizing: "border-box",
        fontSize: "12pt",
      }});
      for (const v of [true, false])
        select.append(m("option", {value: String(v)}, String(v)));
      select.value = String(original === true);
      let changed = false;
      select.addEventListener("change", () => {
        changed = true;
        if (select.value !== String(original === true))
          applyEdit(j, column, select.value === "true");
        else
          finish();
      });
      select.addEventListener("blur", () => {
        if (!changed)
          finish();
      });
      td.replaceChildren(select);
      select.focus();
      return;
    }

    const input = m("input", {"data-testid": "cell-input", type: "text", style: {
      width: "100%",
      boxSizing: "border-box",
      fontSize: "12pt",
      border: isInvalid ? "1px solid var(--color-red-6)" : "1px solid var(--color-blue-6)",
      padding: "0 3px",
    }});
    input.value = initialRaw !== undefined ? initialRaw :
      original === null ? "" :
      original instanceof Date ? original.toISOString() : String(original);
    let closed = false;
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!closed) {
          closed = true;
          commit(input.value);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (!closed) {
          closed = true;
          invalid.delete(cellKeyOf(j, column));
          finish();
        }
      }
    });
    input.addEventListener("blur", () => {
      if (!closed) {
        closed = true;
        commit(input.value); // any outer click commits
      }
    });
    td.replaceChildren(input);
    input.focus();
    input.select();
  }

  function startEdit(td: HTMLTableCellElement, j: number, i: number): void {
    if (editable === undefined || td.querySelector("input,select") !== null)
      return;
    buildEditor(td, j, i, undefined, false);
  }

  function renderBodyCell(r: t.RowValue[], j: number, i: number): HTMLTableCellElement {
    const column = lastProps!.columns[i];
    const key = rowKeyOf(j);
    const cellKey = `${key}:${column}`;
    const edited = editable !== undefined && (edits.get(key)?.changes.has(column) ?? false);
    const td = m("td", {
      style: {
        cursor: editable === undefined ? "default" : "cell",
        fontSize: "12pt",
        padding: "3px 5px",
        overflow: "clip",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        backgroundColor: j % 2 === 0 ? "var(--row-even)" : "",
      },
      "data-testid": "data-cell",
    }, render(edited ? edits.get(key)!.changes.get(column)! : r[i] ?? null));
    if (edited)
      td.classList.add(edited_cell_style);
    if (invalid.has(cellKey)) {
      // Failed commit: keep the typed value in a red-outlined input.
      td.classList.add(invalid_cell_style);
      buildEditor(td, j, i, invalid.get(cellKey), true);
      return td;
    }
    if (editable !== undefined) {
      td.addEventListener("dblclick", () => startEdit(td, j, i));
      td.addEventListener("contextmenu", (e) => openCellMenu(e, j, i));
    }
    return td;
  }

  function renderTable(): void {
    if (lastProps === undefined)
      return;
    const {columns, rows, typenames, types, sortColumns = [], on: {sortAdd: onSortAdd, sortRemove: onSortRemove, sortToggle: onSortToggle}} = lastProps;

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

      const sortColumnMap = new Map(sortColumns.map(sc => [sc.column, sc]));
      el_table.replaceChildren(
        ...columns.flatMap((c, i) => [
          onSortAdd !== undefined || onSortRemove !== undefined || onSortToggle !== undefined
            ? render_column_with_sort(
                c,
                types[i],
                typenames[i],
                sortColumnMap.get(c),
                onSortAdd,
                onSortRemove,
                onSortToggle,
              )
            : render_column(c, types[i]),
          resizeHandles[i],
        ]),
        ...rows.flatMap((r, j) => columns.map((_, i) => renderBodyCell(r, j, i))),
      );

      updateColumnWidths();
  }

  return {
    el,
    update(props: DataTableProps): void {
      lastProps = props;
      renderTable();
    },
    setEditable(next: EditableConfig | undefined): void {
      editable = next;
      if (next === undefined) {
        edits.clear();
        invalid.clear();
      }
      renderTable();
      emitEdits();
    },
    clearEdits(): void {
      edits.clear();
      invalid.clear();
      renderTable();
      emitEdits();
    },
  };
}

const pageSize = 100;

type Props = {
  sourceID: string,
  tableName: string,
  tableInfo: t.TableInfo,
  filterDebounceMs?: number,
};

type SortColumn = {
  column: string,
  direction: "asc" | "desc",
  order: number, // 1-based index for display
};

export default function(
  container: ComponentContainer,
  {sourceID, tableName, tableInfo, filterDebounceMs}: Props,
) {
  const el: HTMLElement = container.element;
  el.replaceChildren(m("div", {class: "h100"}, "Loading table viewer..."));

  const dataTable = DataTable();
  const schemaTable = DataTable();
  const indexesTable = DataTable();
  const constraintsTable = DataTable();
  const relationsTable = DataTable();
  const loading = signal(false);
  const currentPage = signal(0);
  const totalRows = signal(tableInfo.rowCount);

  // Active table filter (from the filter bar); null means unfiltered.
  let currentFilter: t.TableFilter | null = null;

  const sortColumns = signal<SortColumn[]>([]);

  const addSort = (column: string, direction: "asc" | "desc"): void => {
    sortColumns.update(cols => {
      const existingIndex = cols.findIndex(c => c.column === column);
      if (existingIndex >= 0) {
        const newCols = [...cols];
        newCols[existingIndex] = {...newCols[existingIndex], direction};
        return newCols;
      } else {
        return [...cols, {column, direction, order: cols.length + 1}];
      }
    });
  };

  const removeSort = (column: string): void => {
    sortColumns.update(cols => {
      const filtered = cols.filter(c => c.column !== column);
      return filtered.map((c, i) => ({...c, order: i + 1}));
    });
  };

  const toggleSort = (column: string): void => {
    const existing = sortColumns.value.find(c => c.column === column);
    if (existing !== undefined) {
      if (existing.direction === "asc") {
        addSort(column, "desc");
      } else {
        removeSort(column);
      }
    } else {
      addSort(column, "asc");
    }
  };


  // Reload data when sorting changes. The subscription fires once immediately
  // with the initial (empty) sort — skip that to avoid a duplicate first load.
  sortColumns.sub(function*() {
    let initial = true;
    while (true) {
      yield;
      if (initial) {
        initial = false;
        continue;
      }
      loadData(currentPage.value);
    }
  }());

  const prevDisabled = () => currentPage.value === 0;
  const nextDisabled = () => (currentPage.value + 1) * pageSize >= totalRows.value;
  const showingRows = () => {
    const start = totalRows.value === 0 ? 0 : currentPage.value * pageSize + 1;
    const end = Math.min(start + pageSize - 1, totalRows.value);
    return `Showing rows ${start}-${end} of ${totalRows.value}`;
  };

  const prevButton = NButton({
    on: {click: async (): Promise<void> => {
      await loadData(Math.max(0, currentPage.value - 1));
    }},
    disabled: prevDisabled(),
  }, "Previous");
  const nextButton = NButton({
    on: {click: async (): Promise<void> => {
      await loadData(currentPage.value + 1);
    }},
    disabled: nextDisabled(),
  }, "Next");
  const infoSpan = m("span", {}, showingRows());

  const pkColumns = signal<string[]>([]);
  const schemaColumns = signal<t.ColumnInfo[]>([]);
  const readOnly = signal(false);
  const edits = signal<t.CellUpdate[]>([]);

  async function onApply(): Promise<void> {
    const res = await api.requestUpdateTableRowsSQLSource(sourceID, tableName, pkColumns.value, edits.value);
    if (res.kind === "err") {
      notification("error", "Failed to apply edits", {error: res.value});
      return;
    }
    dataTable.clearEdits(); // emits [] -> hides the edit bar
    loadData(currentPage.value);
  }

  async function onCopy(): Promise<void> {
    const res = await api.requestBuildTableUpdateSQLSource(sourceID, tableName, pkColumns.value, edits.value);
    if (res.kind === "err") {
      notification("error", "Could not build update script", {error: res.value});
      return;
    }
    await navigator.clipboard.writeText(res.value);
    notification("info", "Update script copied to clipboard", {});
  }

  const editCountSpan = m("span", {style: {fontSize: ".85em", color: "var(--color-dimmed)"}});
  const applyButton = NButton({primary: true, on: {click: () => onApply()}}, "Apply");
  const copyButton = NButton({on: {click: () => onCopy()}}, "Copy");
  const cancelButton = NButton({on: {click: () => dataTable.clearEdits()}}, "Cancel");
  const el_edits = m("div", {style: {display: "flex", gap: "0.5em", alignItems: "center"}},
    editCountSpan,
    applyButton.el,
    copyButton.el,
    cancelButton.el,
  );
  const bannerSpan = m("span", {style: {fontSize: ".85em", color: "var(--color-yellow-6)"}});
  setDisplay(el_edits, false);
  setDisplay(bannerSpan, false);

  edits.sub(function*() {
    while (true) {
      yield;
      const count = edits.value.length;
      setDisplay(el_edits, count > 0);
      editCountSpan.textContent = `${count} unsaved edit${count === 1 ? "" : "s"}`;
    }
  }());

  // Sync DataTable editability (and the banner) with PK info and readOnly.
  function syncEditing(): void {
    if (pkColumns.value.length === 0 || readOnly.value) {
      dataTable.setEditable(undefined);
      edits.value = [];
      if (pkColumns.value.length === 0) {
        bannerSpan.textContent = "No primary key — editing disabled";
        setDisplay(bannerSpan, true);
      } else {
        bannerSpan.textContent = "Read-only source — editing disabled";
        setDisplay(bannerSpan, true);
      }
      return;
    }
    dataTable.setEditable({
      pkColumns: pkColumns.value,
      nullable: schemaColumns.value.map(c => c.nullable),
      onEditsChange: list => {edits.value = list;},
    });
    setDisplay(bannerSpan, false);
  }

  // The read-only flag lives on the source request data.
  (async () => {
    const res = await api.get(sourceID);
    if (res.kind === "err")
      return;
    readOnly.value = (res.value.Request.Data as t.SQLSourceRequest).readOnly;
    syncEditing();
  })();

  async function loadData(page: number) {
    loading.value = true;
    const read: t.TableRead = {
      table: tableName,
      orderBy: sortColumns.value.map(({column, direction}) => ({column, direction})),
      filter: currentFilter,
      limit: pageSize,
      offset: page * pageSize,
    };
    const res = await api.requestPerformSQLSource(sourceID, read);
    loading.value = false;

    if (res.kind !== "ok") {
      // Keep the current view: an invalid filter (or a failed page load) must
      // not blank the table.
      notification("error", "Could not load data", {error: res.value});
    } else {
      // Commit the page only on success, so pagination stays consistent with
      // the data still on screen after a failed load.
      currentPage.value = page;
      const data = res.value.response as t.SQLResponse;
      dataTable.update({
        columns: data.columns,
        rows: data.rows as t.RowValue[][],
        typenames: data.typenames,
        types: data.types,
        sortColumns: sortColumns.value,
        on: {
          sortAdd: addSort,
          sortRemove: removeSort,
          sortToggle: toggleSort,
        },
      });
    }
    prevButton.disabled = prevDisabled();
    nextButton.disabled = nextDisabled();
    infoSpan.textContent = showingRows();
  }

  async function loadSchema() {
    const res = await api.requestDescribeTableSQLSource(sourceID, tableName);
    if (res.kind === "err") {
      notification("error", "Could not describe table", {error: res.value});
      return;
    }

    const {columns, indexes, constraints, foreign_keys} = res.value;
    schemaTable.update({
      columns: ["Name", "Type", "Nullable", "Default"],
      typenames: [t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.BOOLEAN, t.ColumnType.STRING],
      types: [t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.BOOLEAN, t.ColumnType.STRING],
      rows: columns.map(col => [col.name, col.typename, col.nullable, col.defaultValue]),
      on: {},
    });
    indexesTable.update({
      columns: ["Name", "Definition"],
      typenames: [t.ColumnType.STRING, t.ColumnType.STRING],
      types: [t.ColumnType.STRING, t.ColumnType.STRING],
      rows: indexes.map(idx => [idx.name, idx.definition]),
      on: {},
    });
    // Constraints (foreign keys live in the Relations tab)
    constraintsTable.update({
      columns: ["Name", "Type", "Columns", "Definition"],
      typenames: [t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING],
      types: [t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING],
      rows: constraints.filter(con => con.type !== "FOREIGN KEY").map(con => [con.name, con.type, con.columns.join(", "), con.definition]),
      on: {},
    });
    relationsTable.update({
      columns: ["Name", "Column", "FK Schema", "FK Table", "FK Column", "On Update", "On Delete"],
      typenames: [t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING],
      types: [t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING, t.ColumnType.STRING],
      rows: foreign_keys.map(fk => [fk.name, fk.column, fk.schema, fk.table, fk.to, fk.onUpdate, fk.onDelete]),
      on: {},
    });

    schemaColumns.value = columns;
    pkColumns.value = primaryKeyColumns(res.value);
    syncEditing();
  }

  // Applies a filter from the filter bar: refreshes the filtered row count
  // (so pagination works under filtering) and reloads the first page. A failed
  // load keeps the current view and reports the error.
  const applyFilter = async (filter: t.TableFilter | null): Promise<void> => {
    currentFilter = filter;
    if (filter === null) {
      totalRows.value = tableInfo.rowCount;
    } else {
      const res = await api.requestCountRowsSQLSource(sourceID, tableName, filter);
      if (res.kind === "ok")
        totalRows.value = res.value;
    }
    await loadData(0);
  };

  const el_filter = TableFilter(() => schemaColumns.value,{apply: applyFilter}, {debounceMs: filterDebounceMs});

  loadData(0);
  loadSchema();

  const dataTab = m("div", {class: "h100", style: {display: "flex", flexDirection: "column"}},
    el_filter.el,
    m("div", {style: {display: "flex", gap: "1em", alignItems: "center"}},
      prevButton.el,
      infoSpan,
      nextButton.el,
      bannerSpan,
      el_edits,
    ),
    NScrollbar(dataTable.el),
  );

  const schemaTab = NScrollbar(schemaTable.el);
  const indexesTab = NScrollbar(indexesTable.el);
  const constraintsTab = NScrollbar(constraintsTable.el);
  const relationsTab = NScrollbar(relationsTable.el);

  const tabs = NTabs({
    tabs: [
      {name: "Data", elem: dataTab},
      {name: "Schema", elem: schemaTab},
      {name: "Indexes", elem: indexesTab},
      {name: "Constraints", elem: constraintsTab},
      {name: "Relations", elem: relationsTab},
    ],
  });

  el.replaceChildren(tabs);
}
