import {RequestID} from "@/types.ts";
import {NIcon} from "../components/dataview.ts";
import {CopySharp, DeleteOutlined, EditOutlined, Refresh} from "../components/icons.ts";
import {store} from "../store.ts";
import {DOMNode, m} from "../lib/utils.ts";
import {globalDropdown, renameInit} from "./shared.ts";
import {pluginsByKind} from "../plugins/index.ts";
import {sourceRefresh, sourceRefreshable} from "../plugins/source.ts";

export function showContextMenu(id: RequestID, event: MouseEvent): void {
  // Only real requests have a context menu (virtual items and group folders
  // like "Tools" have no request entry and would crash the lookup below)
  if (!(id in store.requests))
    return;
  const kind = store.requests[id].kind;
  const preOptions: {
    label: string,
    key: string,
    icon?: DOMNode,
    show?: boolean,
    on: {
      click: () => void,
    },
  }[] = [
    // Plugin-provided entries (e.g. "Copy as curl" for HTTP)
    ...(pluginsByKind[kind].menuEntries?.(id) ?? []),
    {
      label: "Refresh",
      key: "refresh",
      icon: NIcon({component: Refresh}),
      show: sourceRefreshable(id),
      on: {
        click: () => sourceRefresh(id),
      },
    },
    {
      label: "Rename",
      key: "rename",
      icon: NIcon({component: EditOutlined}),
      on: {
        click: () => renameInit(id),
      },
    },
    {
      label: "Duplicate",
      key: "duplicate",
      icon: NIcon({component: CopySharp}),
      on: {
        click: () => store.duplicate(id),
      },
    },
    {
      label: "Delete",
      key: "delete",
      icon: NIcon({color: "red", component: DeleteOutlined}),
      on: {
        click: () => store.deleteRequest(id),
      },
    },
  ];
  const options = preOptions.filter(opt => opt.show ?? true).map(opt => {
    const res = m("div", {
      style: {
        padding: "8px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "#ffffff",
      },
      // TODO: remove, put to styles
      onmouseover: (e: Event) => {(e.currentTarget as HTMLElement).style.background = "#404040";},
      onmouseout: (e: Event) => {(e.currentTarget as HTMLElement).style.background = "";},
      onclick: () => {
        opt.on.click();
        globalDropdown.hide();
      },
    }, opt.icon ?? null, opt.label);
    return res;
  });
  globalDropdown.show([event.clientX, event.clientY], options);
}
