import * as t from "@/types.ts";
import {api} from "../api.ts";
import {formatSize} from "../lib/utils.ts";
import {createSourceCache, type Plugin} from "./cache.ts";
import {store} from "../store.ts";

function formatTableLabel(table: t.TableInfo): string {
  return `${table.name} (${table.rowCount.toLocaleString()} rows, ${formatSize(table.sizeBytes)})`;
}

export const sqlSourcePlugin: Plugin<t.TableInfo> = {
  kind: t.Kind.SQLSource,
  kindTag: {text: "SQL*", color: "#70a0e8"},
  cache: createSourceCache<t.TableInfo>({
    fetcher: (id: string) => api.requestListTablesSQLSource(id),
    errorTitle: "Could not fetch tables",
  }),
  itemKey: (table: t.TableInfo) => table.name,
  label: formatTableLabel,
  tag: () => ({
    text: "TBL",
    type: "info",
    style: {backgroundColor: "#1a3a5f", color: "#70c0e8"},
  }),
  onOpen: (id: string, table: t.TableInfo, itemKey: string) =>
    store.openTableViewer(id, itemKey, table),
};
