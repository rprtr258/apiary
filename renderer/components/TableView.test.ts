import {describe, test, expect, mock, beforeEach} from "bun:test";
import RequestTableViewer, {DataTable, primaryKeyColumns} from "./TableView.ts";
import * as t from "@/types.ts";
import {ok} from "@/result.ts";

function col(name: string, type: t.ColumnType, nullable = false): t.ColumnInfo {
  return {
    name,
    typename: type === t.ColumnType.NUMBER ? "int4" :
      type === t.ColumnType.BOOLEAN ? "bool" :
      "text",
    type,
    nullable,
    defaultValue: `""`,
  };
}

function schemaWithPk(columns: t.ColumnInfo[], pkColumns: string[] | null): t.TableSchema {
  return {
    columns,
    constraints: pkColumns === null ? [] : pkColumns.map(name => ({
      name: "PRIMARY",
      type: "PRIMARY KEY",
      definition: `PRIMARY KEY (${name})`,
      columns: [name],
    })),
    foreign_keys: [],
    indexes: [],
  };
}

const DATA: t.SQLResponse = {
  columns: ["id", "name", "active"],
  typenames: ["int4", "text", "bool"],
  types: [t.ColumnType.NUMBER, t.ColumnType.STRING, t.ColumnType.BOOLEAN],
  rows: [[1, "a", false], [2, "b", true]],
};

const SCHEMA: t.TableSchema = schemaWithPk([
  col("id", t.ColumnType.NUMBER),
  col("name", t.ColumnType.STRING, true),
  col("active", t.ColumnType.BOOLEAN),
], ["id"]);

function cells(table: {el: HTMLElement}): HTMLElement[] {
  return [...table.el.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")];
}

function fire(el: Element, type: string): void {
  el.dispatchEvent(new window.Event(type, {bubbles: true}));
}

function fireKey(el: Element, key: string): void {
  el.dispatchEvent(new window.KeyboardEvent("keydown", {key, bubbles: true, cancelable: true}));
}

function fireMouse(el: Element, type: string, x = 10, y = 10): void {
  el.dispatchEvent(new window.MouseEvent(type, {bubbles: true, cancelable: true, clientX: x, clientY: y}));
}

// All api mocks resolve in microtasks (no timers inside the mocks), so any
// chain of component awaits settles before the next macrotask: waiting one
// timer tick is a deterministic wait for the DOM to be updated.
async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("primaryKeyColumns", () => {
  test("single constraint with composite columns (postgres)", () => {
    const schema: t.TableSchema = {
      columns: [col("a", t.ColumnType.NUMBER), col("b", t.ColumnType.NUMBER), col("name", t.ColumnType.STRING)],
      constraints: [{name: "t_pkey", type: "PRIMARY KEY", definition: "PRIMARY KEY (a, b)", columns: ["a", "b"]}],
      foreign_keys: [],
      indexes: [],
    };
    expect(primaryKeyColumns(schema)).toEqual(["a", "b"]);
  });

  test("merges same-name entries (mysql/sqlite report one per column)", () => {
    const schema = schemaWithPk([col("b", t.ColumnType.NUMBER), col("id", t.ColumnType.NUMBER)], ["b", "id"]);
    expect(primaryKeyColumns(schema)).toEqual(["b", "id"]);
  });

  test("no primary key", () => {
    expect(primaryKeyColumns(schemaWithPk([col("id", t.ColumnType.NUMBER)], null))).toEqual([]);
  });

  test("ignores non-PK constraints", () => {
    const schema: t.TableSchema = {
      columns: [col("id", t.ColumnType.NUMBER)],
      constraints: [{name: "u", type: "UNIQUE", definition: "UNIQUE (id)", columns: ["id"]}],
      foreign_keys: [],
      indexes: [],
    };
    expect(primaryKeyColumns(schema)).toEqual([]);
  });
});

describe("DataTable editing", () => {
  function makeTable(): {table: ReturnType<typeof DataTable>, onEdits: (edits: t.CellUpdate[]) => void, edits: t.CellUpdate[][]} {
    const received: t.CellUpdate[][] = [];
    const table = DataTable();
    document.body.append(table.el);
    table.update({
      columns: DATA.columns,
      typenames: DATA.typenames,
      types: DATA.types,
      rows: DATA.rows as t.RowValue[][],
      on: {},
    });
    table.setEditable({
      pkColumns: ["id"],
      nullable: [false, true, false],
      onEditsChange: list => received.push(list),
    });
    return {table, onEdits: list => received.push(list), edits: received};
  }

  test("dblclick opens an input", () => {
    const {table} = makeTable();
    fire(cells(table)[1], "dblclick");
    expect(cells(table)[1].querySelector("[data-testid=\"cell-input\"]")).not.toBeNull();
  });

  test("enter commits the full changed-cell list, row identified by pk values", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[1], "dblclick");
    const input = cells(table)[1].querySelector<HTMLInputElement>("[data-testid=\"cell-input\"]")!;
    input.value = "x";
    fireKey(input, "Enter");
    expect(edits.at(-1)).toEqual([{pkValues: [1], column: "name", value: "x"}]);
    // cell shows the new value and is highlighted; untouched cells are not
    const after = cells(table);
    expect(after[1].textContent).toBe("x");
    expect(after[1].classList.length).toBeGreaterThan(0);
    expect(after[0].classList.length).toBe(0);
  });

  test("committing the original value clears the edit", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[1], "dblclick");
    const input = cells(table)[1].querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    fire(cells(table)[1], "dblclick");
    const input2 = cells(table)[1].querySelector<HTMLInputElement>("input")!;
    input2.value = "a"; // original value
    fireKey(input2, "Enter");
    expect(edits.at(-1)).toEqual([]);
    expect(cells(table)[1].classList.length).toBe(0);
  });

  test("blur (outer click) commits and removes the input", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[1], "dblclick");
    const input = cells(table)[1].querySelector<HTMLInputElement>("input")!;
    input.value = "z";
    fire(input, "blur");
    expect(edits.at(-1)).toEqual([{pkValues: [1], column: "name", value: "z"}]);
    expect(cells(table)[1].querySelector("input")).toBeNull();
  });

  test("escape discards the in-progress edit", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[1], "dblclick");
    const input = cells(table)[1].querySelector<HTMLInputElement>("input")!;
    input.value = "zzz";
    fireKey(input, "Escape");
    expect(edits.at(-1)).toEqual([]);
    expect(cells(table)[1].textContent).toBe("a");
    expect(cells(table)[1].querySelector("input")).toBeNull();
  });

  test("boolean cells get a true/false dropdown", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[2], "dblclick"); // row 0 active=false
    const select = cells(table)[2].querySelector<HTMLSelectElement>("[data-testid=\"cell-select\"]")!;
    expect(select).not.toBeNull();
    expect(select.value).toBe("false");
    select.value = "true";
    fire(select, "change");
    expect(edits.at(-1)).toEqual([{pkValues: [1], column: "active", value: true}]);
    expect(cells(table)[2].querySelector("select")).toBeNull();
  });

  test("boolean dropdown without change closes on blur", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[2], "dblclick");
    const select = cells(table)[2].querySelector<HTMLSelectElement>("select")!;
    fire(select, "blur");
    expect(edits.at(-1)).toEqual([]);
    expect(cells(table)[2].querySelector("select")).toBeNull();
  });

  test("right-click offers Set NULL for nullable columns", () => {
    const {table, edits} = makeTable();
    fireMouse(cells(table)[1], "contextmenu");
    const item = document.querySelector<HTMLElement>("[data-testid=\"set-null\"]")!;
    expect(item).not.toBeNull();
    item.click();
    expect(edits.at(-1)).toEqual([{pkValues: [1], column: "name", value: null}]);
    expect(cells(table)[1].textContent).toBe("(NULL)");
  });

  test("right-click offers nothing for non-nullable columns", () => {
    const {table} = makeTable();
    fireMouse(cells(table)[0], "contextmenu");
    expect(document.querySelector("[data-testid=\"set-null\"]")).toBeNull();
  });

  test("invalid number aborts commit, stays red, and can be fixed", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[0], "dblclick");
    const input = cells(table)[0].querySelector<HTMLInputElement>("input")!;
    input.value = "abc";
    fireKey(input, "Enter");
    expect(edits.at(-1)).toEqual([]); // commit aborted
    // the typed value is kept in a red input, not reverted
    const invalidInput = cells(table)[0].querySelector<HTMLInputElement>("input")!;
    expect(invalidInput).not.toBeNull();
    expect(invalidInput.value).toBe("abc");
    expect(cells(table)[0].classList.length).toBeGreaterThan(0);
    // fixing the value commits
    invalidInput.value = "42";
    fireKey(invalidInput, "Enter");
    expect(edits.at(-1)).toEqual([{pkValues: [1], column: "id", value: 42}]);
    // input gone (no longer invalid), cell shows the committed value
    expect(cells(table)[0].querySelector("input")).toBeNull();
    expect(cells(table)[0].textContent).toBe("42");
  });

  test("edits survive data reload (keyed by pk values)", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[1], "dblclick");
    const input = cells(table)[1].querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    // page reload with the same data re-applies the highlight
    table.update({columns: DATA.columns, typenames: DATA.typenames, types: DATA.types, rows: DATA.rows as t.RowValue[][], on: {}});
    expect(cells(table)[1].textContent).toBe("x");
    expect(cells(table)[1].classList.length).toBeGreaterThan(0);
    expect(edits.at(-1)).toEqual([{pkValues: [1], column: "name", value: "x"}]);
  });

  test("clearEdits resets everything", () => {
    const {table, edits} = makeTable();
    fire(cells(table)[1], "dblclick");
    const input = cells(table)[1].querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    table.clearEdits();
    expect(edits.at(-1)).toEqual([]);
    expect(cells(table)[1].textContent).toBe("a");
    expect(cells(table)[1].classList.length).toBe(0);
  });
});

// --- TableViewer toolbar (mocked api) ---

const state: {
  data: t.SQLResponse,
  schema: t.TableSchema,
  readOnly: boolean,
  updateError: string | undefined,
  performError: string | undefined,
  countRows: number,
} = {
  data: DATA,
  schema: SCHEMA,
  readOnly: false,
  updateError: undefined,
  performError: undefined,
  countRows: 2,
};

const updateCalls: unknown[][] = [];
const buildCalls: unknown[][] = [];
const performCalls: unknown[][] = [];
const countCalls: unknown[][] = [];
const notifications: unknown[][] = [];

// Hoisted by bun to run before the TableView import below.
const apiMock = {
  get: async () => ok({Request: {ID: "s1", Path: "", Data: {database: "postgres", dsn: "", readOnly: state.readOnly}}, History: []} as unknown as t.GetResponse),
  requestPerformSQLSource: async (...args: unknown[]) => {
    performCalls.push(args);
    if (state.performError !== undefined)
      return {kind: "err", value: state.performError} as unknown as t.HistoryEntry;
    return ok({sent_at: "", received_at: "", kind: t.Kind.SQL, request: {}, response: state.data} as unknown as t.HistoryEntry);
  },
  requestCountRowsSQLSource: async (...args: unknown[]) => {
    countCalls.push(args);
    return ok(state.countRows);
  },
  requestDescribeTableSQLSource: async () => ok(state.schema),
  requestUpdateTableRowsSQLSource: async (...args: unknown[]) => {
    updateCalls.push(args);
    if (state.updateError !== undefined)
      return {kind: "err", value: state.updateError} as unknown as t.SQLResponse;
    return ok({columns: [], typenames: [], types: [], rows: []});
  },
  requestBuildTableUpdateSQLSource: async (...args: unknown[]) => {
    buildCalls.push(args);
    return ok("BEGIN;\nCOMMIT;");
  },
};
mock.module("../api.ts", () => ({api: apiMock}));
mock.module("../lib/notification.ts", () => ({
  default: (...args: unknown[]) => {
    notifications.push(args);
  },
}));

function makeViewer(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  RequestTableViewer({element: el, on: () => {}}, {
    sourceID: "s1",
    tableName: "users",
    tableInfo: {name: "users", rowCount: 2, sizeBytes: 10},
    filterDebounceMs: 0, // debounce still schedules a timer, which settles on the next flush tick
  });
  return el;
}

function buttonByText(el: HTMLElement, text: string): HTMLButtonElement {
  const btn = [...el.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent.includes(text));
  expect(btn).not.toBeUndefined();
  if (btn === undefined)
    throw new Error("button not found");
  return btn;
}

function setInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  fire(input, "input");
}

function setColumn(el: HTMLElement, name: string): void {
  // The testid sits on the NSelectInput wrapper; the editable input is inside it.
  const input = el.querySelector<HTMLInputElement>("[data-testid=\"filter-column\"] input");
  expect(input).not.toBeNull();
  setInput(input!, name);
}

function filterValue(el: HTMLElement): HTMLInputElement {
  return el.querySelector<HTMLInputElement>("input[data-testid=\"filter-value\"]")!;
}

function filterExpr(el: HTMLElement): HTMLInputElement {
  return el.querySelector<HTMLInputElement>("input[data-testid=\"filter-expr\"]")!;
}

describe("TableViewer toolbar", () => {
  beforeEach(() => {
    state.schema = SCHEMA;
    state.readOnly = false;
    state.updateError = undefined;
    state.performError = undefined;
    state.countRows = 2;
    updateCalls.length = 0;
    buildCalls.length = 0;
    performCalls.length = 0;
    countCalls.length = 0;
    notifications.length = 0;
  });

  test("apply runs updates by pk and changed columns, then clears and reloads", async () => {
    const el = makeViewer();
    const apply = buttonByText(el, "Apply");
    expect(apply.closest("div")!.style.display).toBe("none"); // hidden with no edits

    // edit a cell (initial load populates the table asynchronously)
    const container = el.querySelector("[data-testid=\"data-container\"]")!;
    await flush();
    const nameCell = container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    expect(apply.closest("div")!.style.display).not.toBe("none"); // sync via the edits signal

    apply.click();
    await flush();
    expect(updateCalls).toEqual([["s1", "users", ["id"], [{pkValues: [1], column: "name", value: "x"}]]]);
    // edits cleared + page reloaded
    const after = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    expect(after.textContent).toBe("a");
  });

  test("no primary key shows the disabled banner and blocks editing", async () => {
    state.schema = schemaWithPk([col("id", t.ColumnType.NUMBER), col("name", t.ColumnType.STRING, true)], null);
    const el = makeViewer();
    await flush();
    const banner = [...el.querySelectorAll("span")].find(s => s.textContent === "No primary key — editing disabled");
    expect(banner).toBeDefined();
    expect(banner!.style.display).not.toBe("none");
    // double-click does nothing
    const cell = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll("[data-testid=\"data-cell\"]")[1];
    fire(cell, "dblclick");
    expect(cell.querySelector("input")).toBeNull();
  });

  test("read-only source shows the banner and blocks editing", async () => {
    state.readOnly = true;
    const el = makeViewer();
    await flush();
    const banner = [...el.querySelectorAll("span")].find(s => s.textContent === "Read-only source — editing disabled");
    expect(banner).toBeDefined();
    expect(banner!.style.display).not.toBe("none");
  });

  test("copy requests the script from the main process", async () => {
    const el = makeViewer();
    const container = el.querySelector("[data-testid=\"data-container\"]")!;
    await flush();
    const nameCell = container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    expect(buttonByText(el, "Apply").closest("div")!.style.display).not.toBe("none");
    buttonByText(el, "Copy").click(); // the mock logs the request synchronously
    expect(buildCalls).toEqual([["s1", "users", ["id"], [{pkValues: [1], column: "name", value: "x"}]]]);
  });

  test("foreign keys render in the Relations tab and are excluded from Constraints", async () => {
    state.schema = {
      columns: [col("id", t.ColumnType.NUMBER), col("user_id", t.ColumnType.NUMBER)],
      constraints: [
        {name: "PRIMARY", type: "PRIMARY KEY", definition: "PRIMARY KEY (id)", columns: ["id"]},
        {name: "fk_user", type: "FOREIGN KEY", definition: "FOREIGN KEY (user_id) REFERENCES users (id)", columns: ["user_id"]},
      ],
      foreign_keys: [{name: "fk_user", column: "user_id", schema: "public", table: "users", to: "id", onUpdate: "CASCADE", onDelete: "SET NULL"}],
      indexes: [],
    };
    const el = makeViewer();
    // NTabs keeps every tab's content in the DOM (inactive tabs are hidden):
    // children are [header, data, schema, indexes, constraints, relations]
    const contents = el.children[0].children;
    const relations = contents[5] as HTMLElement;
    const constraintsTab = contents[4] as HTMLElement;
    await flush();
    expect(relations.textContent).toContain("fk_user");
    expect(relations.textContent).toContain("user_id");
    expect(relations.textContent).toContain("public");
    expect(relations.textContent).toContain("CASCADE");
    expect(relations.textContent).toContain("SET NULL");
    // foreign keys no longer appear in the constraints tab
    expect(constraintsTab.textContent).not.toContain("fk_user");
    expect(constraintsTab.textContent).not.toContain("FOREIGN KEY");
    expect(constraintsTab.textContent).toContain("PRIMARY");
  });

  test("cancel clears edits", async () => {
    const el = makeViewer();
    const container = el.querySelector("[data-testid=\"data-container\"]")!;
    await flush();
    const nameCell = container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    const apply = buttonByText(el, "Apply");
    expect(apply.closest("div")!.style.display).not.toBe("none");

    // Cancel is a synchronous clearEdits: restores the cell text and hides the bar
    buttonByText(el, "Cancel").click();
    const after = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    expect(after.textContent).toBe("a");
    expect(apply.closest("div")!.style.display).toBe("none");
  });

  test("filter applies debounced with the value, refreshes the filtered count, and paginates", async () => {
    state.countRows = 250;
    const el = makeViewer();
    await flush(); // initial load
    expect(performCalls.length).toBe(1);

    setColumn(el, "id");
    setInput(filterValue(el), "5");
    await flush(); // the 0ms debounce applies on the next timer tick
    const read = performCalls[1][1] as t.TableRead;
    expect(read.filter).toEqual({kind: "simple", column: "id", op: "=", value: "5"});
    expect(read.offset).toBe(0); // filter change reloads the first page
    expect(countCalls).toEqual([["s1", "users", {kind: "simple", column: "id", op: "=", value: "5"}]]);
    expect(el.textContent).toContain("of 250"); // pagination shows the filtered count

    // paging keeps the active filter and moves the offset
    buttonByText(el, "Next").click();
    await flush();
    const nextRead = performCalls[2][1] as t.TableRead;
    expect(nextRead.filter).toEqual({kind: "simple", column: "id", op: "=", value: "5"});
    expect(nextRead.offset).toBe(100);

    // clearing the value removes the filter and restores the full row count
    setInput(filterValue(el), "");
    await flush();
    expect((performCalls[3][1] as t.TableRead).filter).toBeNull();
    expect(countCalls.length).toBe(1); // no extra count for the unfiltered view
    expect(el.textContent).toContain("of 2");
  });

  test("invalid manual filter shows an error notification and keeps the view", async () => {
    const el = makeViewer();
    const container = el.querySelector("[data-testid=\"data-container\"]")!;
    await flush();
    expect(container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]").length).toBeGreaterThan(0);
    state.performError = "syntax error at or near \"==\"";

    buttonByText(el, "Manual").click();
    const builderRow: HTMLElement | null = el.querySelector("[data-testid=\"filter-builder-row\"]");
    expect(builderRow?.style.display).toBe("none");
    setInput(filterExpr(el), "id ==");
    await flush();
    expect(performCalls.length).toBe(2);
    const read = performCalls[1][1] as t.TableRead;
    expect(read.filter).toEqual({kind: "manual", expr: "id =="});
    // error notification carries the engine error
    expect(notifications.some(n => n[0] === "error" && n[1] === "Could not load data" &&
      (n[2] as {error: string}).error === "syntax error at or near \"==\"")).toBe(true);
    // the view still shows the previous data (not blanked)
    const cell = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    expect(cell.textContent).toBe("a");
  });

  test("cell editing still works while a filter is active", async () => {
    const el = makeViewer();
    await flush(); // initial load
    expect(el.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]").length).toBeGreaterThan(0);

    setColumn(el, "id");
    setInput(filterValue(el), "1");
    await flush();
    expect(performCalls.length).toBe(2);
    // re-query after the filtered reload replaced the table content
    const nameCell = el.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    const apply = buttonByText(el, "Apply");
    expect(apply.closest("div")!.style.display).not.toBe("none");
    apply.click();
    await flush();
    // updates go through by pk while the filter is active, and the reload
    // that follows still carries the active filter
    expect(updateCalls).toEqual([["s1", "users", ["id"], [{pkValues: [1], column: "name", value: "x"}]]]);
    expect((performCalls.at(-1)![1] as t.TableRead).filter).toEqual({kind: "simple", column: "id", op: "=", value: "1"});
  });
});
