import * as t from "@/types.ts";
import {store} from "../../store.ts";
import {Plugin} from "../types.ts";
import {root, componentType, StateSQLSourceTable} from "./item.ts";
import {setDisplay} from "../../lib/utils.ts";
import RequestTableViewer from "../../components/TableView.ts";
import RequestSQLSource from "./viewer.ts";

export const sqlSourcePlugin: Plugin = {
  kind: t.Kind.SQLSource,
  frame: args => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestSQLSource(args.el, {update: args.on.update});
  },
  viewers: {
    [componentType]: (container, state) => RequestTableViewer(container, state as StateSQLSourceTable),
  },
  menuEntries: id => [
    {
      label: "New draft query",
      key: "new-draft-query",
      on: {
        click: () => {
          store.createDraft(t.Kind.SQL, {
            dsn: id,
            // subKind stores the Database value as a plain string (requestPreview), so
            // narrowing back to t.Database is safe for SQL-source rows.
            database: store.requests[id].subKind as t.Database,
            query: "SELECT 1",
          });
        },
      },
    },
  ],
  root,
};
