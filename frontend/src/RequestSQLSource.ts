import {database} from "../wailsjs/go/models.ts";
import {NEmpty} from "./components/dataview.ts";
import {NInput, NInputGroup, NSelect} from "./components/input.ts";
import {NTabs} from "./components/layout.ts";
import SchemaCanvas from "./components/SchemaCanvas.ts";
import {get_request} from "./store.ts";
import {Database, api} from "./api.ts";
import {m} from "./utils.ts";

type Request = database.SQLSourceRequest;

function StatusLabel() {
  const el = m("div", {style: {fontSize: ".8em", height: "1.2em"}});
  return {
    el,
    setStatus(message: string, isSuccess: boolean) {
      el.textContent = message;
      el.style.color = isSuccess ? "green" : "red";
    },
  };
}

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

      const updateConnectionStatus = async (): Promise<void> => {
        const res = await api.requestTestSQLSource(requestID);
        res.map_or_else(
          _ => statusLabel.setStatus("Database connection successful!", true),
          err => statusLabel.setStatus(`Database connection failed: ${err}`, false),
        );
      };

      const update_request = async (patch: Partial<Request>): Promise<void> => {
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
          label: Database[request.database],
          options: Object
            .keys(Database)
            .map(db => db as keyof typeof Database)
            .map(db => ({label: Database[db], value: db})),
          on: {update: (database: string) => update_request({database: database as Database})},
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
        m("div", {style: {display: "flex", gap: "1em", color: "#666", fontSize: ".8em"}},
          m("input", {
            type: "checkbox",
            disabled: true,
          }), // TODO: implement
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
