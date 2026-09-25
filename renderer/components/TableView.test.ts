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

// Polls until the assertion callback passes (stops throwing) or times out.
async function waitFor(assert: () => void, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      assert();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs)
        throw error;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
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
} = {
  data: DATA,
  schema: SCHEMA,
  readOnly: false,
  updateError: undefined,
};

const updateCalls: unknown[][] = [];
const buildCalls: unknown[][] = [];

// Hoisted by bun to run before the TableView import below.
const apiMock = {
  get: async () => ok({Request: {ID: "s1", Path: "", Data: {database: "postgres", dsn: "", readOnly: state.readOnly}}, History: []} as unknown as t.GetResponse),
  requestPerformSQLSource: async () => ok({sent_at: "", received_at: "", kind: t.Kind.SQL, request: {}, response: state.data} as unknown as t.HistoryEntry),
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

function makeViewer(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  RequestTableViewer({element: el, on: () => {}}, {
    sqlSourceID: "s1",
    tableName: "users",
    tableInfo: {name: "users", rowCount: 2, sizeBytes: 10},
    database: "postgres",
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

describe("TableViewer toolbar", () => {
  beforeEach(() => {
    state.schema = SCHEMA;
    state.readOnly = false;
    state.updateError = undefined;
    updateCalls.length = 0;
    buildCalls.length = 0;
  });

  test("apply runs updates by pk and changed columns, then clears and reloads", async () => {
    const el = makeViewer();
    const apply = buttonByText(el, "Apply");
    expect(apply.closest("div")!.style.display).toBe("none"); // hidden with no edits

    // edit a cell (initial load populates the table asynchronously)
    const container = el.querySelector("[data-testid=\"data-container\"]")!;
    await waitFor(() => expect(container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]").length).toBeGreaterThan(0));
    const nameCell = container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    await waitFor(() => expect(apply.closest("div")!.style.display).not.toBe("none"));

    apply.click();
    await waitFor(() => {
      expect(updateCalls).toEqual([["s1", "users", ["id"], [{pkValues: [1], column: "name", value: "x"}]]]);
      // edits cleared + page reloaded
      const after = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
      expect(after.textContent).toBe("a");
    });
  });

  test("no primary key shows the disabled banner and blocks editing", async () => {
    state.schema = schemaWithPk([col("id", t.ColumnType.NUMBER), col("name", t.ColumnType.STRING, true)], null);
    const el = makeViewer();
    let banner: HTMLElement | undefined;
    await waitFor(() => {
      banner = [...el.querySelectorAll("span")].find(s => s.textContent === "No primary key — editing disabled");
      expect(banner).toBeDefined();
    });
    expect(banner!.style.display).not.toBe("none");
    // double-click does nothing
    const cell = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll("[data-testid=\"data-cell\"]")[1];
    fire(cell, "dblclick");
    expect(cell.querySelector("input")).toBeNull();
  });

  test("read-only source shows the banner and blocks editing", async () => {
    state.readOnly = true;
    const el = makeViewer();
    let banner: HTMLElement | undefined;
    await waitFor(() => {
      banner = [...el.querySelectorAll("span")].find(s => s.textContent === "Read-only source — editing disabled");
      expect(banner).toBeDefined();
    });
    expect(banner!.style.display).not.toBe("none");
  });

  test("copy requests the script from the main process", async () => {
    const el = makeViewer();
    const container = el.querySelector("[data-testid=\"data-container\"]")!;
    await waitFor(() => expect(container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]").length).toBeGreaterThan(0));
    const nameCell = container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    await waitFor(() => expect(buttonByText(el, "Apply").closest("div")!.style.display).not.toBe("none"));
    buttonByText(el, "Copy").click();
    await waitFor(() => expect(buildCalls).toEqual([["s1", "users", ["id"], [{pkValues: [1], column: "name", value: "x"}]]]));
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
    await waitFor(() => expect(relations.textContent).toContain("fk_user"));
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
    await waitFor(() => expect(container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]").length).toBeGreaterThan(0));
    const nameCell = container.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
    fire(nameCell, "dblclick");
    const input = nameCell.querySelector<HTMLInputElement>("input")!;
    input.value = "x";
    fireKey(input, "Enter");
    await waitFor(() => expect(buttonByText(el, "Apply").closest("div")!.style.display).not.toBe("none"));
    buttonByText(el, "Cancel").click();
    await waitFor(() => {
      const after = el.querySelector("[data-testid=\"data-container\"]")!.querySelectorAll<HTMLElement>("[data-testid=\"data-cell\"]")[1];
      expect(after.textContent).toBe("a");
    });
    const apply = buttonByText(el, "Apply");
    expect(apply.closest("div")!.style.display).toBe("none");
  });
});
