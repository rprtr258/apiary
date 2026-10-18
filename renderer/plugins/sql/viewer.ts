import * as t from "@/types.ts";
import {m, setDisplay, Signal} from "../../lib/utils.ts";
import {api} from "../../api.ts";
import {get_request, store} from "../../store.ts";
import {NEmpty} from "../../components/dataview.ts";
import {NButton, NInputGroup, NSelect, NSelectInput} from "../../components/input.ts";
import {NScrollbar, NSplit, NTabs} from "../../components/layout.ts";
import {DataTable} from "../../components/TableView.ts";
import EditorSQL from "../../EditorSQL.ts";

type Request = t.SQLRequest;

type PlanState =
  | {kind: "idle"}
  | {kind: "loading"}
  | {kind: "error", message: string}
  | {kind: "plan", plan: t.SQLExplain};

function requestKey(request: Request): string {
  return JSON.stringify([request.dsn, request.database, request.query]);
}

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: t.HistoryEntry): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));
  const dataTable = DataTable();
  const el_scrollable = NScrollbar(dataTable.el);
  const el_response = NEmpty({description: "Run query to see the results."});
  const push_response = (response: t.SQLResponse | undefined) => {
    if (response === undefined)
      return;

    // TODO: fix duplicate column names
    el_response.style.justifyContent = "";
    dataTable.update({columns: response.columns, rows: response.rows as t.RowValue[][], typenames: response.typenames, types: response.types, on: {}});
  };
  const unmounts: (() => void)[] = [];

  // Plan tab: the plan is fetched for the current request when the tab is
  // opened, kept while the query/dsn/database stay unchanged. The plan renders
  // as plain text for every database.
  let current: get_request | null = null;
  let plan_shown = false;
  let plan_key: string | null = null;
  let plan_state: PlanState = {kind: "idle"};
  // Flex column with definite height: the plan pre (flex: 1) fills the pane and
  // scrolls inside it instead of stretching the pane's parent.
  const el_plan = m("div", {style: {height: "100%", display: "flex", flexDirection: "column", overflow: "hidden"}});
  function render_plan(): void {
    const node =
      plan_state.kind === "plan" ? m("pre", {style: {margin: "8px", whiteSpace: "pre-wrap", overflow: "auto", flex: "1", minHeight: "0"}}, plan_state.plan.raw) :
      plan_state.kind === "error" ? m("pre", {style: {margin: "8px", whiteSpace: "pre-wrap", overflow: "auto", flex: "1", minHeight: "0"}}, plan_state.message) :
      NEmpty({description: plan_state.kind === "loading" ? "Running EXPLAIN..." : "Open this tab to fetch the plan."});
    el_plan.replaceChildren(node);
  }
  async function fetch_plan(): Promise<void> {
    if (current === null)
      return;
    const request = current.request as Request;
    const key = requestKey(request);
    if (key === plan_key)
      return;
    plan_key = key;
    plan_state = {kind: "loading"};
    render_plan();
    const fetched = current;
    const res = await api.requestExplainSQL(current.request.id);
    if (current !== fetched) // request switched while fetching
      return;
    plan_state = res.kind === "ok" ?
      {kind: "plan", plan: res.value} :
      {kind: "error", message: res.value};
    render_plan();
  }
  const tabs = NTabs({
    tabs: [
      {name: "Data", elem: el_scrollable, onSelect: () => {
        plan_shown = false;
      }},
      {name: "Plan", elem: el_plan, onSelect: () => {
        plan_shown = true;
        fetch_plan();
      }},
    ],
  });

  return {
    loaded: (r: get_request): void => {
      current = r;
      plan_key = null;
      plan_state = {kind: "idle"};
      render_plan();
      if (plan_shown)
        fetch_plan();
      el_response.replaceChildren(tabs);

      const request = r.request as Request;
      const el_run = NButton({
        primary: true,
        on: {click: async () => {
          await on.send();
        }},
      }, "Run");
      const el_editor = EditorSQL({
        value: request.query,
        on: {update: (query: string) => update_request({query})},
        class: "h100",
      });
      const db_select = NSelect({
        style: {minWidth: "0"},
        label: t.Database[request.database],
        options: Object.keys(t.Database).map(db => ({label: t.Database[db as keyof typeof t.Database], value: db})),
        on: {update: (database: string) => {
          // DSN options list only sources of the chosen database, so a chosen source cannot be kept.
          const patch: Partial<Request> = {database: database as t.Database};
          const current = r.request as Request; // live request, the captured `request` is stale after updates
          if (current.dsn in store.requests && store.requests[current.dsn].kind === t.Kind.SQLSource && store.requests[current.dsn].subKind !== database) {
            patch.dsn = "";
          }
          update_request(patch);
        }},
      });
      const dsn_select = NSelectInput({
        placeholder: "DSN",
        options: () => Object.entries(store.requests)
          .filter(([, source]) => source.kind === t.Kind.SQLSource && source.subKind === (r.request as Request).database)
          .map(([id, source]) => ({label: source.path, value: id})),
        value: request.dsn,
        on: {update: (dsn: string) => update_request({dsn})},
      });
      const update_request = (patch: Partial<Request>): void => {
        el_run.disabled = true;
        on.update(patch).then(() => {
          el_run.disabled = false;
        });
      };

      const el_input_group = NInputGroup({
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 10fr 1fr",
        },
      },
        db_select.el,
        dsn_select.el,
        el_run.el,
      );

      const split = NSplit(el_editor, el_response, {style: {minHeight: "0"}});
      const el_split = split.element;
      const el_container = m("div", {class: "h100", style: {
        display: "flex",
        flexDirection: "column",
      }}, el_input_group, el_split);
      unmounts.push(show_request.sub(function*() {
        while (true) {
          const show_request = yield;
          split.leftVisible = show_request;
          setDisplay(el_input_group, show_request);
        }
      }()));
      el.replaceChildren(el_container);
    },
    push_history_entry(he: t.HistoryEntry) {
      push_response(he.response as t.SQLResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
};
