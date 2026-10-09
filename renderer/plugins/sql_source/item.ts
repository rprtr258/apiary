import * as t from "@/types.ts";
import type {Item} from "../source.ts";
import {api} from "../../api.ts";
import {formatSize} from "../../lib/utils.ts";
import {createSourceCache, listChildren} from "../cache.ts";
import {store} from "../../store.ts";

export const componentType = "TableViewer";
export type StateSQLSourceTable = {
  sourceID: string,
  itemKey: string,
  tableName: string,
  tableInfo: t.TableInfo,
};

function formatTableLabel(table: t.TableInfo): string {
  return `${table.name} (${table.rowCount.toLocaleString()} rows, ${formatSize(table.sizeBytes)})`;
}

const tablesCache = createSourceCache<t.TableInfo>(
  id => api.requestListTablesSQLSource(id),
  "Could not fetch tables",
);

function toTableItem(id: string, table: t.TableInfo): Item {
  return {
    key: table.name,
    label: formatTableLabel(table),
    badge: {
      label: "TBL",
      color: "#70c0e8",
      background: "#1a3a5f",
    },
    onOpen: () => store.openViewer(table.name, componentType, {
      sourceID: id,
      itemKey: table.name,
      tableName: table.name,
      tableInfo: table,
    }),
  };
}

export function root(id: t.RequestID): Item {
  return {
    key: "",
    label: "",
    badge: {label: "SQL*", color: "#70a0e8"},
    children: () => listChildren(tablesCache, id, t => toTableItem(id, t)),
    loading: () => tablesCache.get(id)?.loading ?? false,
    refresh: () => tablesCache.fetch(id),
  };
}
