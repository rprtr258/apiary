import Split from "split-grid";
import {database} from "../wailsjs/go/models.ts";
import {NEmpty, NIcon} from "./components/dataview.ts";
import {NButton, NInput, NInputGroup, NSelect} from "./components/input.ts";
import {NScrollbar} from "./components/layout.ts";
import {CheckSquareOutlined, ClockCircleOutlined, FieldNumberOutlined, ItalicOutlined, QuestionCircleOutlined} from "./components/icons.ts";
import EditorSQL from "./EditorSQL.ts";
import {get_request, last_history_entry} from "./store.ts";
import {Database, HistoryEntry, RowValue} from "./api.ts";
import {DOMNode, m, Signal} from "./utils.ts";

type Request = database.SQLRequest;

function NSplit(left: HTMLElement, right: HTMLElement) {
  const el_line = m("hr", {style: {cursor: "row-resize"}});
  const el = m("div", {
    class: "h100",
    id: "split",
    style: {
      display: "grid",
      // gridTemplateRows: "auto 1fr",
      // gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 5px 3fr",
      gridColumnGap: ".5em",
    } as Partial<CSSStyleDeclaration>,
  },
    left,
    el_line,
    right,
  );
  Split({
    rowGutters: [
      {track: 1, element: el_line},
    ],
  });
  return el;
}

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
  return m("div", {
    style: {overflowY: "scroll"},
  }, [m("table", {style: tableBorderStyle}, [
    m("thead", {}, [
      m("tr", {}, columns.map((c, i) =>
        m("th", {style: tableBorderStyle}, render_column(c, types[i])))),
    ]),
    m("tbody", {}, rows.map(r =>
      m("tr", {}, columns.map((_, i) =>
        m("td", {
          style: tableBorderStyle,
        }, render(r[i])))))),
  ])]);
}

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>, // TODO: remove, show by default
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void, // show last history entry
  // TODO: hide/show request
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
    if (response === null) {return;}

    // TODO: fix duplicate column names
    el_response.replaceChildren(NScrollbar(
      DataTable({
        columns: response.columns,
        rows: response.rows as RowValue[][],
        types: response.types,
      }),
    ));
  };

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
        // class: "h100",
      });
      if (!show_request.value) {
        el_editor.style.display = "none";
      }
      const update_request = (patch: Partial<Request>): void => {
        el_run.disabled = true;
        on.update(patch).then(() => {
          el_run.disabled = false;
        });
      };

      el.replaceChildren(m("div", {
          class: "h100",
          id: "gavno",
        },
        show_request.value ? NInputGroup({
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
            // style: {width: "10%"},
          }).el,
          NInput({
            placeholder: "DSN",
            value: request.dsn,
            on: {update: (newValue: string) => update_request({dsn: newValue})},
          }),
          el_run,
        ) : null,
        NSplit(
          el_editor,
          el_response,
        ),
      ));
    },
    push_history_entry(he: HistoryEntry) {
      push_response(he.response as database.SQLResponse);
    },
  };
};

// <style lang="css" scoped>
// .n-tab-pane {
//   height: 100% !important;
// }
// </style>
// <style lang="css">
// /* TODO: как же я ненавижу ебаный цсс блять господи за что */
// #gavno > .n-layout-scroll-container {
//   overflow: hidden;
//   height: 100%;
//   display: grid;
//   grid-template-rows: 34px 1fr;
// }
// </style>
