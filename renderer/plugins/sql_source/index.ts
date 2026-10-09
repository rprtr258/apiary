import * as t from "@/types.ts";
import {api} from "../../api.ts";
import {formatSize, setDisplay} from "../../lib/utils.ts";
import {createSourceCache} from "../cache.ts";
import {store} from "../../store.ts";
import RequestTableViewer from "../../components/TableView.ts";
import RequestSQLSource from "./viewer.ts";
import {Plugin} from "../types.ts";

const componentType = "TableViewer";
type StateSQLSourceTable = {
  sourceID: string,
  itemKey: string,
  tableName: string,
  tableInfo: t.TableInfo,
};

function formatTableLabel(table: t.TableInfo): string {
  return `${table.name} (${table.rowCount.toLocaleString()} rows, ${formatSize(table.sizeBytes)})`;
}

export const sqlSourcePlugin: Plugin<t.TableInfo> = {
  kind: t.Kind.SQLSource,
  kindTag: {text: "SQL*", color: "#70a0e8"},
  frame: args => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestSQLSource(args.el, {update: args.on.update});
  },
  cache: createSourceCache<t.TableInfo>(
    id => api.requestListTablesSQLSource(id),
    "Could not fetch tables",
  ),
  itemKey: table => table.name,
  label: formatTableLabel,
  tag: _ => ({
    text: "TBL",
    type: "info",
    style: {backgroundColor: "#1a3a5f", color: "#70c0e8"},
  }),
  viewer: {
    componentType,
    factory: (container, state) => RequestTableViewer(container, state as StateSQLSourceTable),
  },
  onOpen: (id, table, itemKey) =>
    store.openViewer(componentType, itemKey, {sourceID: id, itemKey, tableName: itemKey, tableInfo: table}),
};
