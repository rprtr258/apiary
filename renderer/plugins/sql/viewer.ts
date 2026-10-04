import * as t from "@/types.ts";
import {m, setDisplay, Signal} from "../../lib/utils.ts";
import {api} from "../../api.ts";
import {useRequest} from "../../hooks/useRequest.ts";
import {get_request, store} from "../../store.ts";
import {NEmpty} from "../../components/dataview.ts";
import NButton from "../../components/button.ts";
import {NSelect, NSelectInput} from "../../components/input_select.ts";
import {NInputGroup} from "../../components/input.ts";
import {NScrollbar, NSplit, NTabs} from "../../components/layout.ts";
import {DataTable} from "../../components/TableView.ts";
import EditorSQL from "../../EditorSQL.ts";
import PlanDiagram from "./plan.ts";

type Request = t.SQLRequest;

type PlanState =
  | {kind: "idle"}
  | {kind: "loading"}
  | {kind: "error", message: string}
  | {kind: "plan", plan: t.SQLExplain};

function requestKey(request: Request): string {
  return JSON.stringify([request.dsn, request.database, request.query]);
}

function pre(text: string): HTMLElement {
  return m("pre", {style: {
    margin: "8px",
    whiteSpace: "pre-wrap",
    overflow: "auto",
    flex: "1",
    minHeight: "0",
  }}, text);
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
  const requestHook = useRequest<t.SQLRequest>({initialRequest: {
    database: "postgres",
    dsn: "",
    query: "",
  }, on: {update: on.update}});

  // Plan tabs: the plan is fetched for the current request when either tab is
  // opened, kept while the query/dsn/database stay unchanged, and never
  // stored in history. "Plan" draws the parsed unified-format tree;
  // "Plan (raw)" shows the backend's own EXPLAIN text. One EXPLAIN round trip
  // feeds both (EXPLAIN ANALYZE actually executes the query on some backends).
  let current: get_request | null = null;
  let plan_shown = false;
  let plan_key: string | null = null;
  let plan_state: PlanState = {kind: "idle"};
  // Flex column with definite height: the panes (flex: 1) fill the tab and
  // scroll inside it instead of stretching the pane's parent.
  const paneStyle = {height: "100%", display: "flex", flexDirection: "column", overflow: "hidden"};
  const el_plan = m("div", {style: paneStyle});
  const el_plan_raw = m("div", {style: paneStyle});
  const diagram = PlanDiagram(el_plan);
  unmounts.push(diagram.unmount);
  function render_plan(): void {
    if (plan_state.kind === "plan") {
      if (plan_state.plan.plan !== undefined) {
        el_plan.replaceChildren(diagram.el);
        diagram.loaded(plan_state.plan.plan);
      } else {
        el_plan.replaceChildren(NEmpty({description: "Could not parse the plan — see the Plan (raw) tab."}));
      }
      el_plan_raw.replaceChildren(pre(plan_state.plan.raw));
      return;
    }
    const node =
      plan_state.kind === "error" ? pre(plan_state.message) :
      NEmpty({description:
        plan_state.kind === "loading" ? "Running EXPLAIN..." :
        "Open this tab to fetch the plan."});
    el_plan.replaceChildren(node);
    el_plan_raw.replaceChildren(node.cloneNode(true));
  }
  async function fetch_plan(): Promise<void> {
    if (current === null)
      return;
    const request = current.request as Request;
    const key = requestKey(request);
    // NTabs fires onSelect only on tab change, so reaching here after a
    // failed fetch means the tab was hidden and shown again - retry it.
    if (key === plan_key && plan_state.kind !== "error")
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
        diagram.fit();
        fetch_plan();
      }},
      {name: "Plan (raw)", elem: el_plan_raw, onSelect: () => {
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
      requestHook.requestSignal.value = request;
      const el_run = NButton({
        primary: true,
        on: {click: async () => {
          await on.send().catch(() => {});
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
        requestHook.update(patch).finally(() => {
          el_run.disabled = false;
        }).catch(() => {
          db_select.set(requestHook.requestSignal.value.database);
          dsn_select.set(requestHook.requestSignal.value.dsn);
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
