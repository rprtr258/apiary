import m, {Vnode} from "mithril";
import {NEmpty, NIcon, NTooltip} from "./components/dataview";
import {NButton, NInput, NInputGroup, NSelect} from "./components/input";
import {database} from "../wailsjs/go/models";
import EditorSQL from "./EditorSQL";
import {use_sql_source} from "./store";
import {Database} from "./api";

type Request = {kind: database.Kind.SQLSource} & database.SQLSourceRequest;

const NSplit = {
  view(vnode: Vnode<{}, any>) {
    const children = vnode.children as Vnode<any, any>[];
    return m("div", {
      class: "h100",
      style: {
        display: "grid",
        // "grid-template-columns": "1fr 1fr",
        // "grid-template-rows": "auto 1fr",
        "grid-template-rows": "1fr 0px 3fr",
        "grid-column-gap": ".5em",
      },
    }, [
      children[0],
      // m("hr"),
      children[1],
    ]);
  },
}

type TableBaseColumn = {
  key: string,
  title: (_: TableBaseColumn) => m.Vnode,
  render: (rowData: any) => any,
};
type DataTableProps = {
  columns: TableBaseColumn[],
  data: any[],
  "single-line": false,
  size: "small",
  resizable: true,
  "scroll-x": number,
}
const DataTable = {
  view(vnode: Vnode<DataTableProps, any>) {
    const {columns, data} = vnode.attrs;
    const tableBorderStyle = {
      "table-layout": "fixed",
      border: "1px solid #888",
      "border-collapse": "collapse",
      padding: "3px 5px",
    };
    return m("div", {
      "overflow-y": "scroll",
      ...vnode.attrs,
    }, m("table", {style: tableBorderStyle}, [
      m("thead", {}, [
        m("tr", {}, columns.map(({key}) =>
          m("th", {style: tableBorderStyle}, key))),
      ]),
      m("tbody", {}, data.map(r =>
        m("tr", {}, columns.map(c =>
          m("td", {
            style: tableBorderStyle,
          }, c.render(r)))))),
    ]));
  },
}

export default function(
  id: string,
  show_request: () => boolean,
): m.Component<any, any> {
  let query = "";
  return {
    view() {
      const r = use_sql_source(id);

      const update_request = (patch: Partial<database.SQLSourceRequest>): void => {
        r.update_request(patch).then(m.redraw);
      };

      const columns = (() => {
        const resp = r.response;
        if (resp === null) {
          return [];
        }

        return (resp.columns ?? []).map((c: string): TableBaseColumn => {
          return {
            key: c,
            title: (_: TableBaseColumn) => {
              const type = resp.types[resp.columns.indexOf(c)];
              return m(NTooltip, {
                trigger: "hover",
                placement: "bottom-start",
                ontrigger: () => m("div", [
                  m(NIcon, {
                    size: 15,
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
                default: () => type,
              });
            },
            render: (rowData: any) => {
              const v = rowData[c];
              switch (true) {
              case v === null:
                return m("span", {style: {color: "grey"}}, "(NULL)");
              case typeof v == "boolean":
                return v ? "true" : "false";
              case typeof v == "number" || typeof v == "string":
                return v;
              default:
                return rowData[c];
              }
            },
          }
        });
      })();
      // TODO: fix duplicate column names
      const data = (() => {
        const resp = r.response;
        if (resp === null) {
          return [];
        }

        return (resp.rows ?? [])
          .map(row =>
            Object.fromEntries(row
              .map((v, i) => [resp.columns[i], v])));
      })();

      if (r.request === null)
        return m(NEmpty, {
          description: "Loading request...",
          class: "h100",
          style: {"justify-content": "center"},
        });

      return m("div", {
          class: "h100",
          id: "gavno",
        },
        [
          show_request() && m(NInputGroup, {
            style: {
              "grid-column": "span 2",
              display: "grid",
              "grid-template-columns": "1fr 10fr 1fr",
            },
          }, [
            m(NSelect, {
              value: r.request.database,
              options: Object.keys(Database).map(db => ({label: Database[db as keyof typeof Database], value: db})),
              on: {update: (database: string) => update_request({database: database as Database})},
              // style: {width: "10%"},
            }),
            m(NInput, {
              placeholder: "DSN",
              value: r.request.dsn,
              on: {input: (newValue: string) => update_request({dsn: newValue})},
            }),
            m(NButton, {
              type: "primary",
              on: {click: () => r.send(query)},
              disabled: r.is_loading,
            }, "Run"),
          ]),
          m(NSplit, {}, [
            show_request() && m(EditorSQL, {
              value: query,
              on: {update: (q: string) => query = q},
              class: "h100",
            }),
            r.response === null ?
            m(NEmpty, {
              description: "Run query or choose one from history.",
              class: "h100",
              style: {"justify-content": "center"},
            }) :
            // m(NScrollbar,
              m(DataTable, {
                columns: columns,
                data: data,
                "single-line": false,
                size: "small",
                resizable: true,
                "scroll-x": r.response.columns.length * 200,
              })
            // ),
          ]),
        ],
      );
    },
  };
};
