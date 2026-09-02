import * as t from "@/types.ts";
import {api} from "./api.ts";
import {get_request} from "./store.ts";
import {m} from "./lib/utils.ts";
import {NEmpty, StatusLabel} from "./components/dataview.ts";
import {NInput, NInputGroup, NSelect} from "./components/input.ts";
import {NTabs} from "./components/layout.ts";
import SchemaCanvas from "./components/SchemaCanvas.ts";

type Request = t.SQLSourceRequest;

export default function(
  el: HTMLElement,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
  },
): {
  loaded: (r: get_request) => void,
  unmount(): void,
} {
  // let query = ""; // TODO: query datasource/scratch request?

  el.replaceChildren(NEmpty({description: "Loading source..."}));
  const unmounts: (() => void)[] = [];

  return {
    loaded: (r: get_request): void => {
      const requestID = r.request.id;
      const request = r.request as Request;
      const statusLabel = StatusLabel();

      async function updateConnectionStatus(): Promise<void> {
        const res = await api.requestTestSQLSource(requestID);
        statusLabel.setStatus(res.map_or_else(
          _ => "Database connection successful!",
          err => `Database connection failed: ${err}`,
        ), res.kind === "ok");
      };

      async function update_request(patch: Partial<Request>): Promise<void> {
        await on.update(patch);
        await updateConnectionStatus();
      };
      const el_connection_tab = NInputGroup({
        style: {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: ".8em",
          padding: "0 3em",
        },
      }, [
        NSelect({
          label: t.Database[request.database],
          options: Object
            .keys(t.Database)
            .map(db => db as keyof typeof t.Database)
            .map(db => ({label: t.Database[db], value: db})),
          on: {update: (database: string) => update_request({database: database as t.Database})},
        }).el,
        m("div", {style: {
          display: "flex",
          width: "100%",
        }},
          NInput({
            style: {
              flexGrow: "1",
            },
            placeholder: "DSN",
            value: request.dsn,
            on: {update: (newValue: string) => update_request({dsn: newValue})},
          }),
          // TODO: file picker for sqlite
          // m("button", {
          //   style: {
          //     border: "2px",
          //     padding: "4px 8px",
          //     cursor: "pointer",
          //   },
          //   onclick: () => {
          //     window.showOpenFilePicker().then(fs => {
          //       if (fs.length !== 1) return;
          //       console.log(fs[0]);
          //     });
          //   },
          // }, "Choose File"),
        ),
        m("div", {style: {display: "flex", gap: "1em", fontSize: ".8em", alignItems: "center"}},
          (() => {
            const cb = m("input", {
              type: "checkbox",
              onchange: (e: Event) => update_request({readOnly: (e.target as HTMLInputElement).checked}),
            });
            cb.checked = request.readOnly === true;
            return cb;
          })(),
          "Read Only Mode",
        ),
        statusLabel.el,
      ]);

      const el_schema_tab = m("div", {class: "h100"});
      const schema = SchemaCanvas(el_schema_tab);

      const el_container = NTabs({
        tabs: [
          {name: "Connection", elem: el_connection_tab},
          {name: "Schema", elem: el_schema_tab},
        ],
      });

      el.replaceChildren(el_container);
      updateConnectionStatus(); // Initial check

      // Load schema
      (async () => {
        const tableInfos = await api.requestListTablesSQLSource(requestID);
        if (tableInfos.kind === "err") {
          console.error("Could not load schema", tableInfos.value);
          return;
        }
        const results = await Promise.all(tableInfos.value.map(async tableInfo => {
          const schema = await api.requestDescribeTableSQLSource(requestID, tableInfo.name);
          return schema.kind === "ok" ? {name: tableInfo.name, schema: schema.value} : null;
        }));
        const tables = results.filter((t): t is NonNullable<typeof t> => t !== null);
        schema.loaded(tables);
      })();
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
};
