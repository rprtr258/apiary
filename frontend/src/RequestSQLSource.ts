import {database} from "../wailsjs/go/models.ts";
import {NEmpty, NIcon, NTooltip} from "./components/dataview.ts";
import {NScrollbar} from "./components/layout.ts";
import {NButton, NInput, NInputGroup, NSelect} from "./components/input.ts";
import EditorSQL from "./EditorSQL.ts";
import {get_request, use_sql_source} from "./store.ts";
import {Database, RowValue} from "./api.ts";
import {DOMNode, m} from "./utils.ts";

type Request = {kind: database.Kind.SQLSource} & database.SQLSourceRequest;

function NSplit(children: DOMNode[]) {
  return m("div", {
    class: "h100",
    style: {
      display: "grid",
      // gridTemplateColumns: "1fr 1fr",
      // gridTemplateRows: "auto 1fr",
      gridTemplateRows: "1fr 0px 3fr",
      gridColumnGap: ".5em",
    },
  }, [
    children[0],
    // m("hr"),
    children[1],
  ]);
}

type TableBaseColumn = {
  key: string,
  title: (_: TableBaseColumn) => DOMNode,
  render: (rowData: RowValue) => DOMNode,
};
type DataTableProps = {
  columns: TableBaseColumn[],
  data: Record<string, RowValue>[],
  "single-line": false,
  size: "small",
  resizable: true,
  "scroll-x": number,
};
function DataTable({columns, data}: DataTableProps) {
  const tableBorderStyle = {
    "table-layout": "fixed",
    border: "1px solid #888",
    "border-collapse": "collapse",
    padding: "3px 5px",
  };
  return m("div", {
    style: {overflowY: "scroll"},
  }, [m("table", {style: tableBorderStyle}, [
    m("thead", {}, [
      m("tr", {}, columns.map(({key}) =>
        m("th", {style: tableBorderStyle}, [key]))),
    ]),
    m("tbody", {}, data.map(r =>
      m("tr", {}, columns.map(c =>
        m("td", {
          style: tableBorderStyle,
        }, [c.render(r[c.key])]))))),
  ])]);
}

export default function(
  el: HTMLElement,
  show_request: () => boolean,
): {loaded: (r: get_request) => void} {
  let query = "";
  return {loaded: (r: get_request) => {
    const request = use_sql_source(r.request.id);

    const update_request = (patch: Partial<database.SQLSourceRequest>): void => {
      request.update_request(patch);//.then(m.redraw);
    };

    const columns = (() => {
      const resp = request.response;
      if (resp === null) {
        return [];
      }

      return (resp.columns ?? []).map((c: string): TableBaseColumn => {
        return {
          key: c,
          title: (_: TableBaseColumn) => {
            const type = resp.types[resp.columns.indexOf(c)];
            return NTooltip({},
              m("div", {}, [
                NIcon({
                  // size: 15,
                  color: "grey",
                  component:
                    type === "number" ? "FieldNumberOutlined" :
                    type === "string" ? "ItalicOutlined" :
                    type === "bool" ? "CheckSquareOutlined" :
                    type === "time" ? "ClockCircleOutlined" :
                      "QuestionCircleOutlined",
                }),
                c,
              ]),
              // default: () => type,
            );
          },
          render: (v: RowValue): DOMNode => {
            switch (true) {
            case v === null:
              return m("span", {style: {color: "grey"}}, ["(NULL)"]);
            case typeof v == "boolean":
              return v ? "true" : "false";
            case typeof v == "number" || typeof v == "string":
              return String(v);
            default:
              alert(`unknown row value type: ${String(v)} : ${typeof v}`);
              return String(v);
            }
          },
        };
      });
    })();
    // TODO: fix duplicate column names
    const data = (() => {
      const resp = request.response;
      if (resp === null) {
        return [];
      }

      return (resp.rows ?? [])
        .map(row =>
          Object.fromEntries(row
            .map((v, i) => [resp.columns[i], v])));
    })();

    if (r.request === null)
      return NEmpty({
        description: "Loading request...",
        class: "h100",
        style: {justifyContent: "center"},
      });
    const select = NSelect({
      label: request.request!.database,
      options: Object.keys(Database).map(db => ({label: Database[db as keyof typeof Database], value: db})),
      on: {update: (database: string) => update_request({database: database as Database})},
      // style: {width: "10%"},
    });

    return m("div", {
        class: "h100",
        id: "gavno",
      },
      [
        ...(show_request() ? [NInputGroup({
          style: {
            gridColumn: "span 2",
            display: "grid",
            gridTemplateColumns: "1fr 10fr 1fr",
          },
        }, [
          select.el,
          NInput({
            placeholder: "DSN",
            value: request.request?.dsn,
            on: {update: (newValue: string) => update_request({dsn: newValue})},
          }),
          NButton({
            type: "primary",
            on: {click: () => request.send(query)},
            disabled: request.is_loading,
          }, ["Run"]),
        ])] : []),
        NSplit([
          ...(show_request() ? [EditorSQL({
            value: query,
            on: {update: (q: string) => query = q},
            class: "h100",
          })] : []),
          request.response === null ?
          NEmpty({
            description: "Run query or choose one from history.",
            class: "h100",
            style: {justifyContent: "center"},
          }) :
          NScrollbar(
            DataTable({
              columns,
              data,
              "single-line": false,
              size: "small",
              resizable: true,
              "scroll-x": request.response.columns.length * 200,
            }),
          ),
        ]),
      ],
    );
  }};
};
