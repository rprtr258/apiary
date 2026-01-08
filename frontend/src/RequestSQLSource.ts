import {database} from "../wailsjs/go/models.ts";
import {NEmpty} from "./components/dataview.ts";
import {NInput, NInputGroup, NSelect} from "./components/input.ts";
import {get_request} from "./store.ts";
import {Database} from "./api.ts";

type Request = database.SQLSourceRequest;

export default function(
  el: HTMLElement,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
  },
): {
  loaded: (r: get_request) => void,
  unmount(): void,
} {
  el.replaceChildren(NEmpty({description: "Loading source..."}));

  // let query = ""; // TODO: query datasource/scratch request?
  const unmounts: (() => void)[] = [];
  return {
    loaded: (r: get_request): void => {
      const request = r.request as Request;

      const update_request = (patch: Partial<Request>): void => {
        on.update(patch);
      };

      const select = NSelect({
        label: Database[request.database],
        options: Object.keys(Database).map(db => ({label: Database[db as keyof typeof Database], value: db})),
        on: {update: (database: string) => update_request({database: database as Database})},
        // style: {width: "10%"},
      });

      const el_input_group = NInputGroup({
        style: {
          gridColumn: "span 2",
          display: "grid",
          gridTemplateColumns: "1fr 10fr",
        },
      }, [
        select.el,
        NInput({
          placeholder: "DSN",
          value: request?.dsn,
          on: {update: (newValue: string) => update_request({dsn: newValue})},
        }),
      ]);

      const el_container = el_input_group;
      el.replaceChildren(el_container);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
};
