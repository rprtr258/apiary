import * as t from "@/types.ts";
import {m} from "../lib/utils.ts";
import {NButton, NInput, NSelect, NSelectInput} from "./input.ts";

// Operators that compare against the value input, in display order; the null
// checks take no value and apply as soon as they are selected.
const VALUE_OPS: t.FilterOp[] = ["=", "!=", "like", "not like", "<", "<=", ">", ">=", "in"];
const NULL_OPS: t.FilterOp[] = ["is null", "is not null"];

/** Filter bar for the table viewer: a "Manual" toggle plus a column picker,
 * operator picker and value input. Builder mode filters one column with one
 * operator; manual mode takes a full SQL condition instead. Every change is
 * applied debounced — value operators only when a column is picked and the
 * value is not empty, the null checks as soon as they are selected (only
 * offered for nullable columns). The raw value string is sent as is; parsing
 * into SQL literal(s) happens in the main process. */
export default function TableFilter(
  columns: () => t.ColumnInfo[],
  on: {
    apply: (filter: t.TableFilter | null) => void,
  },
  options?: {debounceMs?: number},
): {el: HTMLElement} {
  const debounceMs = options?.debounceMs ?? 1000;

  let column = "";
  let op: t.FilterOp = "=";
  let value = "";
  let expr = "";
  let manual = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const builderFilter = (): t.TableFilter | null => {
    if (column === "")
      return null;
    if (!VALUE_OPS.includes(op))
      return {kind: "simple", column, op, value: null};
    if (value === "")
      return null;
    return {kind: "simple", column, op, value};
  };

  const currentFilter = (): t.TableFilter | null =>
    manual ? (expr.trim() === "" ? null : {kind: "manual", expr}) : builderFilter();

  // Debounced: a filter change is applied 1s after the last edit.
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      on.apply(currentFilter());
    }, debounceMs);
  };

  const el_column = NSelectInput({
    placeholder: "Column",
    options: () => columns().map(c => ({label: c.name, value: c.name})),
    value: "",
    style: {width: "140px", flexShrink: "0"},
    on: {update: c => {
      column = c;
      // Null checks are not offered for NOT NULL columns: drop a selected
      // null check when such a column gets picked.
      const col = columns().find(cc => cc.name === c);
      if (col !== undefined && !col.nullable && !VALUE_OPS.includes(op)) {
        op = "=";
        el_value.disabled = false;
      }
      rebuildOpSelect();
      schedule();
    }},
  });
  // Which operators are offered depends on the picked column's nullability,
  // so the op select is rebuilt on column changes.
  const el_op_slot = m("div", {style: {display: "contents"}});
  function rebuildOpSelect(): void {
    const col = columns().find(c => c.name === column);
    const select = NSelect<t.FilterOp>({
      options: (col !== undefined && !col.nullable ? VALUE_OPS : [...VALUE_OPS, ...NULL_OPS])
        .map(o => ({label: o, value: o})),
      label: op,
      style: {flexShrink: "0"},
      on: {update: next => {
        op = next;
        // Null checks ignore the value input: disable and clear it so the
        // stored value cannot leak into a later operator switch.
        const nullOp = !VALUE_OPS.includes(op);
        el_value.disabled = nullOp;
        if (nullOp) {
          el_value.value = "";
          value = "";
        }
        schedule();
      }},
    });
    select.el.setAttribute("data-testid", "filter-op");
    el_op_slot.replaceChildren(select.el);
  }
  rebuildOpSelect();
  const el_value = NInput({
    placeholder: "Value",
    style: {flex: "1 1 120px", minWidth: "80px"},
    on: {update: v => {
      value = v;
      if (column === "")
        return; // no column picked: value edits cannot form a filter, no apply
      schedule();
    }},
  });
  const el_expr = NInput({
    placeholder: "SQL condition, e.g. name LIKE 'a%' AND age >= 18",
    style: {flex: "1 1 200px"},
    on: {update: v => {
      expr = v;
      schedule();
    }},
  });

  const el_builder = m("div", {"data-testid": "filter-builder-row", style: {display: "flex", gap: "5px", alignItems: "center", flex: "1", minWidth: "0"}},
    el_column.el,
    el_op_slot,
    el_value,
  );
  const el_manual = m("div", {"data-testid": "filter-manual-row", style: {display: "none", gap: "5px", alignItems: "center", flex: "1", minWidth: "0"}},
    el_expr,
  );
  // One toggle button switching between structured and manual mode. Both
  // words are stacked in one grid cell inside the label so the button keeps
  // a constant width regardless of the current mode.
  const el_label_manual = m("span", {style: {gridArea: "1 / 1"}}, "Manual");
  const el_label_builder = m("span", {style: {gridArea: "1 / 1"}}, "Structured");
  const el_toggle = NButton({on: {click: () => setManual(!manual)}},
    m("span", {style: {display: "inline-grid"}}, el_label_manual, el_label_builder));

  function renderMode(): void {
    el_builder.style.display = manual ? "none" : "flex";
    el_manual.style.display = manual ? "flex" : "none";
    el_label_manual.style.visibility = manual ? "hidden" : "";
    el_label_builder.style.visibility = manual ? "" : "hidden";
  }
  function setManual(next: boolean): void {
    manual = next;
    renderMode();
    schedule(); // mode switch switches to the other filter definition
  }
  renderMode();

  el_column.el.setAttribute("data-testid", "filter-column");
  el_value.setAttribute("data-testid", "filter-value");
  el_expr.setAttribute("data-testid", "filter-expr");

  const el = m("div", {style: {display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap", minHeight: "30px"}},
    el_toggle.el,
    el_builder,
    el_manual,
  );

  return {el};
}
