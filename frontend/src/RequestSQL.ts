
import {database} from "../wailsjs/go/models.ts";
import {NEmpty, NIcon} from "./components/dataview.ts";
import {NButton, NInput, NInputGroup, NSelect} from "./components/input.ts";
import {NScrollbar, NSplit} from "./components/layout.ts";
import {CheckSquareOutlined, ClockCircleOutlined, FieldNumberOutlined, ItalicOutlined, QuestionCircleOutlined} from "./components/icons.ts";
import EditorSQL from "./EditorSQL.ts";
import {get_request, last_history_entry} from "./store.ts";
import {Database, HistoryEntry, RowValue} from "./api.ts";
import {DOMNode, m, setDisplay, Signal} from "./utils.ts";

type Request = database.SQLRequest;

function render(v: RowValue): DOMNode {
  switch (true) {
  case v === null:
    return m("span", {style: {color: "grey"}}, "(NULL)");
  case typeof v == "boolean":
    return v ? "true" : "false";
  case typeof v == "number":
    return m("span", {style: {color: "#e84e40"}}, String(v));
  case typeof v == "string":
    return v;
  default:
    alert(`unknown row value type: ${String(v)} : ${typeof v}`);
    return String(v);
  }
}
function render_column(c: string, typ: string) {
  return m("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: "0.5em",
    },
    title: typ,
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
  rows: RowValue[][],
  types: string[],
};
function DataTable({columns, rows, types}: DataTableProps) {
  const tableBorderStyle: Partial<CSSStyleDeclaration> = {
    tableLayout: "fixed",
    border: "1px solid #888",
    borderCollapse: "collapse",
    padding: "3px 5px",
  };
  return m("table", {style: tableBorderStyle}, [
    m("thead", {}, [
      m("tr", {}, columns.map((c, i) =>
        m("th", {style: tableBorderStyle}, render_column(c, types[i])))),
    ]),
    m("tbody", {}, rows.map(r =>
      m("tr", {}, columns.map((_, i) =>
        m("td", {
          style: tableBorderStyle,
        }, render(r[i])))))),
  ]);
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
  push_history_entry(he: HistoryEntry): void, // show last history entry
  unmount(): void,
} {
  el.append(NEmpty({
    description: "Loading request...",
    class: "h100",
    style: {justifyContent: "center"},
  }));
  const el_response = NEmpty({
    description: "Run query or choose one from history.",
    // class: "h100",
    style: {justifyContent: "center"},
  });
  const push_response = (response: database.SQLResponse | null) => {
    if (response === null) return;

    // TODO: fix duplicate column names
    el_response.style.justifyContent = "";
    el_response.replaceChildren(NScrollbar(DataTable({
      columns: response.columns,
      rows: response.rows as RowValue[][],
      types: response.types,
    })));
  };
  const unmounts: (() => void)[] = [];

  return {
    loaded: (r: get_request): void => {
      push_response(last_history_entry(r)?.response as database.SQLResponse | null);

      const request = r.request as database.SQLRequest;
      const el_run = NButton({
        type: "primary",
        on: {click: () => {
          el_run.disabled = true;
          on.send().then(() => {
            el_run.disabled = false;
            // TODO: refetch
          });
        }},
      }, "Run");
      const el_editor = EditorSQL({
        value: request.query,
        on: {update: (query: string) => update_request({query})},
        class: "h100",
      });
      const update_request = (patch: Partial<Request>): void => {
        el_run.disabled = true;
        on.update(patch).then(() => {
          el_run.disabled = false;
        });
      };

      const el_input_group = NInputGroup({
        style: {
          gridColumn: "span 2",
          display: "grid",
          gridTemplateColumns: "1fr 10fr 1fr",
        },
      },
        NSelect({
          label: Database[request.database],
          options: Object.keys(Database).map(db => ({label: Database[db as keyof typeof Database], value: db})),
          on: {update: (database: string) => update_request({database: database as Database})},
        }).el,
        NInput({
          placeholder: "DSN",
          value: request.dsn,
          on: {update: (newValue: string) => update_request({dsn: newValue})},
        }),
        el_run,
      );

      const split = NSplit(el_editor, el_response, {style: {minHeight: "0"}});
      const el_split = split.element;
      const el_container = m("div", {class: "h100", style: {
        display: "flex",
        flexDirection: "column",
      }}, el_input_group, el_split);
      unmounts.push(show_request.sub((show_request: boolean) => {
        split.leftVisible = show_request;
        setDisplay(el_input_group, show_request);
      }));
      el.replaceChildren(el_container);
    },
    push_history_entry(he: HistoryEntry) {
      push_response(he.response as database.SQLResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
};
