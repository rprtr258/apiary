import {RequestID} from "@/types.ts";
import {NIcon} from "../components/dataview.ts";
import {CopySharp, DeleteOutlined, EditOutlined, Refresh} from "../components/icons.ts";
import {store} from "../store.ts";
import {DOMNode, m} from "../lib/utils.ts";
import {globalDropdown, renameInit} from "./shared.ts";
import {pluginsByKind} from "../plugins/index.ts";
import {sourceRefresh, sourceRefreshable, parseVirtualKey} from "../plugins/source.ts";

type MenuOption = {
  label: string,
  key: string,
  icon?: DOMNode,
  show?: boolean,
  on: {
    click: () => void,
  },
};

function renderOption(opt: MenuOption): HTMLDivElement {
  return m("div", {
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
}

export function showContextMenu(id: RequestID, event: MouseEvent): void {
  if (!(id in store.requests)) {
    // Virtual items (source listings, placeholders) have no menu; the only
    // other tree keys are real directories
    if (parseVirtualKey(id).isSome())
      return;
    showDirectoryContextMenu(id, event);
    return;
  }
  const kind = store.requests[id].kind;
  const preOptions: MenuOption[] = [
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
  const options = preOptions.filter(opt => opt.show ?? true).map(renderOption);
  globalDropdown.show([event.clientX, event.clientY], options);
}

// Directories are implicit "/"-prefix groupings of requests, so the menu is
// delete-only: it removes the directory with everything under it. DeleteDir
// takes the directory key - the full dir path with a trailing "/" (that key
// form is what makes the root unaddressable); the sidebar spells dir keys
// without it, so it is appended here
function showDirectoryContextMenu(dir: string, event: MouseEvent): void {
  const option: MenuOption = {
    label: "Delete",
    key: "delete",
    icon: NIcon({color: "red", component: DeleteOutlined}),
    on: {
      click: () => store.deleteDir(dir + "/"),
    },
  };
  globalDropdown.show([event.clientX, event.clientY], [renderOption(option)]);
}
