import {describe, test, expect} from "bun:test";
import * as t from "@/types.ts";
import TableFilter from "./TableFilter.ts";

function col(name: string, type: t.ColumnType, nullable: boolean): t.ColumnInfo {
  return {name, typename: "", type, nullable, defaultValue: ""};
}

const COLUMNS = [
  col("id", t.ColumnType.NUMBER, false),
  col("name", t.ColumnType.STRING, true),
  col("flag", t.ColumnType.BOOLEAN, false),
];

// Operator option order used by the component's select (value ops, then null checks).
const OPS: t.FilterOp[] = ["=", "!=", "like", "not like", "<", "<=", ">", ">=", "in", "is null", "is not null"];

async function sleep(ms: number): Promise<void> {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(assert: () => void, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      assert();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs)
        throw error;
      await sleep(2);
    }
  }
}

function makeFilter(): {el: HTMLElement, applied: (t.TableFilter | null)[]} {
  const applied: (t.TableFilter | null)[] = [];
  const el = TableFilter(() => COLUMNS, {apply: f => {applied.push(f);}}, {debounceMs: 5}).el;
  document.body.append(el);
  return {el, applied};
}

function inputByTestId(el: HTMLElement, testId: string): HTMLInputElement {
  const input = el.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
  if (input === null)
    throw new Error(`input ${testId} not found`);
  return input;
}

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new window.Event("input", {bubbles: true}));
}

function setColumn(el: HTMLElement, name: string): void {
  // The testid sits on the NSelectInput wrapper; the editable input is inside it.
  const input = el.querySelector<HTMLInputElement>("[data-testid=\"filter-column\"] input");
  if (input === null)
    throw new Error("column input not found");
  setValue(input, name);
}

function selectOp(el: HTMLElement, op: t.FilterOp): void {
  const sel = el.querySelector<HTMLSelectElement>("[data-testid=\"filter-op\"]");
  if (sel === null)
    throw new Error("op select not found");
  sel.value = String(OPS.indexOf(op));
  sel.dispatchEvent(new window.Event("change", {bubbles: true}));
}

function opOptionLabels(el: HTMLElement): string[] {
  return [...el.querySelectorAll<HTMLSelectElement>("[data-testid=\"filter-op\"] option")]
    .map(o => o.textContent)
    .filter(l => l !== "");
}

function selectedOp(el: HTMLElement): string {
  const sel = el.querySelector<HTMLSelectElement>("[data-testid=\"filter-op\"]");
  if (sel === null)
    throw new Error("op select not found");
  return sel.options[sel.selectedIndex].textContent;
}

function buttonByText(el: HTMLElement, text: string): HTMLButtonElement {
  const btn = [...el.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent.includes(text));
  if (btn === undefined)
    throw new Error(`button ${text} not found`);
  return btn;
}

function rowByTestId(el: HTMLElement, testId: string): HTMLElement | null {
  return el.querySelector(`[data-testid="${testId}"]`);
}

describe("TableFilter", () => {
  test("applies nothing on mount", () => {
    const {applied} = makeFilter();
    expect(applied).toEqual([]);
  });

  test("applies the filter after the debounce once column and value are set", async () => {
    const {el, applied} = makeFilter();
    setValue(inputByTestId(el, "filter-value"), "5");
    setColumn(el, "id");
    expect(applied).toEqual([]); // debounced, not applied yet
    await waitFor(() => expect(applied).toEqual([{kind: "simple", column: "id", op: "=", value: "5"}]));
  });

  test("rapid value edits coalesce into one debounced apply", async () => {
    const {el, applied} = makeFilter();
    setColumn(el, "id");
    setValue(inputByTestId(el, "filter-value"), "1");
    setValue(inputByTestId(el, "filter-value"), "12");
    setValue(inputByTestId(el, "filter-value"), "123");
    await waitFor(() => expect(applied).toEqual([{kind: "simple", column: "id", op: "=", value: "123"}]));
  });

  test("missing column means no apply; empty value means no filter", async () => {
    const {el, applied} = makeFilter();
    setValue(inputByTestId(el, "filter-value"), "5"); // no column picked yet
    await sleep(50); // past the debounce
    expect(applied).toEqual([]); // value edits without a column do not apply at all
    setColumn(el, "id");
    await waitFor(() => expect(applied).toEqual([{kind: "simple", column: "id", op: "=", value: "5"}]));
    // clearing the value removes the filter again
    setValue(inputByTestId(el, "filter-value"), "");
    await waitFor(() => expect(applied).toEqual([{kind: "simple", column: "id", op: "=", value: "5"}, null]));
  });

  test("passes the raw value string through unchanged", async () => {
    const {el, applied} = makeFilter();
    setColumn(el, "name");
    setValue(inputByTestId(el, "filter-value"), "abc");
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "simple", column: "name", op: "=", value: "abc"}));
    setColumn(el, "flag");
    setValue(inputByTestId(el, "filter-value"), "TRUE");
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "simple", column: "flag", op: "=", value: "TRUE"}));
    setColumn(el, "id");
    setValue(inputByTestId(el, "filter-value"), "5");
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "simple", column: "id", op: "=", value: "5"}));
  });

  test("in passes the raw value; the main process splits it", async () => {
    const {el, applied} = makeFilter();
    setColumn(el, "id");
    selectOp(el, "in");
    setValue(inputByTestId(el, "filter-value"), "1, 2 ,3");
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "simple", column: "id", op: "in", value: "1, 2 ,3"}));
  });

  test("is null applies without a value and disables the value input", async () => {
    const {el, applied} = makeFilter();
    setColumn(el, "name");
    selectOp(el, "is null");
    expect(inputByTestId(el, "filter-value").disabled).toBe(true);
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "simple", column: "name", op: "is null", value: null}));
    // switching back to a value operator re-enables the input; empty value -> no filter
    selectOp(el, "like");
    expect(inputByTestId(el, "filter-value").disabled).toBe(false);
    await waitFor(() => expect(applied.at(-1)).toBeNull());
  });

  test("null-check ops are not offered for NOT NULL columns", () => {
    const {el} = makeFilter();
    setColumn(el, "id"); // NOT NULL
    expect(opOptionLabels(el)).toEqual(OPS.filter(o => o !== "is null" && o !== "is not null"));
    setColumn(el, "name"); // nullable
    expect(opOptionLabels(el)).toEqual(OPS);
  });

  test("switching to a NOT NULL column drops a selected null check", async () => {
    const {el, applied} = makeFilter();
    setColumn(el, "name");
    selectOp(el, "is null");
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "simple", column: "name", op: "is null", value: null}));
    expect(inputByTestId(el, "filter-value").disabled).toBe(true);
    setColumn(el, "id");
    await waitFor(() => expect(applied.at(-1)).toEqual(null));
    expect(selectedOp(el)).toBe("=");
    expect(inputByTestId(el, "filter-value").disabled).toBe(false);
  });

  test("manual mode replaces pickers and applies a raw SQL condition", async () => {
    const {el, applied} = makeFilter();
    buttonByText(el, "Manual").click();
    expect(rowByTestId(el, "filter-builder-row")?.style.display).toBe("none");
    expect(rowByTestId(el, "filter-manual-row")?.style.display).toBe("flex");
    const expr = inputByTestId(el, "filter-expr");
    setValue(expr, "name LIKE 'a%'");
    await waitFor(() => expect(applied.at(-1)).toEqual({kind: "manual", expr: "name LIKE 'a%'"}));
    setValue(expr, "");
    await waitFor(() => expect(applied.at(-1)).toBeNull());
    buttonByText(el, "Structured").click();
    expect(rowByTestId(el, "filter-builder-row")?.style.display).toBe("flex");
    expect(rowByTestId(el, "filter-manual-row")?.style.display).toBe("none");
  });

  test("mode switch re-applies the other mode's current filter", async () => {
    const {el, applied} = makeFilter();
    setColumn(el, "id");
    setValue(inputByTestId(el, "filter-value"), "7");
    await waitFor(() => expect(applied).toHaveLength(1));
    buttonByText(el, "Manual").click();
    // the manual expression is empty, so the filter is removed
    await waitFor(() => expect(applied.at(-1)).toBeNull());
  });
});
