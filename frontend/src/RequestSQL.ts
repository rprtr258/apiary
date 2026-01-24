import {database} from "../wailsjs/go/models.ts";
import {Database, HistoryEntry, RowValue} from "./types.ts";
import {m, setDisplay, Signal} from "./utils.ts";
import {get_request, last_history_entry} from "./store.ts";
import {NEmpty} from "./components/dataview.ts";
import {NButton, NInput, NInputGroup, NSelect} from "./components/input.ts";
import {NScrollbar, NSplit} from "./components/layout.ts";
import {DataTable} from "./components/TableView.ts";
import EditorSQL from "./EditorSQL.ts";

type Request = database.SQLRequest;

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));
  const dataTable = DataTable();
  const el_scrollable = NScrollbar(dataTable.el);
  const el_response = NEmpty({description: "Run query or choose one from history."});
  const push_response = (response: database.SQLResponse | undefined) => {
    if (response === undefined)
      return;

    // TODO: fix duplicate column names
    el_response.style.justifyContent = "";
    dataTable.update({columns: response.columns, rows: response.rows as RowValue[][], types: response.types});
  };
  const unmounts: (() => void)[] = [];

  return {
    loaded: (r: get_request): void => {
      push_response(last_history_entry(r)?.response as database.SQLResponse | undefined);
      el_response.replaceChildren(el_scrollable);

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
          style: {minWidth: "0"},
          label: Database[request.database],
          options: Object.keys(Database).map(db => ({label: Database[db as keyof typeof Database], value: db})),
          on: {update: (database: string) => update_request({database: database as Database})},
        }).el,
        NInput({
          placeholder: "DSN",
          value: request.dsn,
          on: {update: (newValue: string) => update_request({dsn: newValue})},
        }),
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
