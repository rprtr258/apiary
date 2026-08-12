import * as t from "@/types.ts";
import {NIcon} from "../components/dataview.ts";
import {ContentCopyFilled, CopySharp, DeleteOutlined, EditOutlined, Refresh} from "../components/icons.ts";
import {api} from "../api.ts";
import {store} from "../store.ts";
import notification from "../lib/notification.ts";
import {DOMNode, m} from "../lib/utils.ts";
import {globalDropdown, renameInit} from "./shared.ts";
import {fetchEndpoints, fetchTables} from "./sourceCache.ts";

export function showContextMenu(id: string, event: MouseEvent): void {
  const preOptions: {
    label: string,
    key: string,
    icon?: DOMNode,
    show?: boolean,
    on: {
      click: () => void,
    },
  }[] = [
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
        click: () => {
          store.duplicate(id);
        },
      },
    },
    {
      label: "Copy as curl",
      key: "copy-as-curl",
      icon: NIcon({component: ContentCopyFilled}),
      show: store.requests[id].kind === t.Kind.HTTP,
      on: {
        click: () => {
          api.get(id).then(r => {
            if (r.kind === "err") {
              notification.error({title: "Error", content: `Failed to load request: ${r.value}`});
              return;
            }

            const req = r.value.Request as unknown as t.HTTPRequest; // TODO: remove unknown cast
            const httpToCurl = ({url, method, body, headers}: t.HTTPRequest) => {
              const headersStr = headers.length > 0 ? " " + headers.map(({key, value}) => `-H "${key}: ${value}"`).join(" ") : "";
              const bodyStr = body !== "" ? ` -d '${body}'` : "";
              return `curl -X ${method} ${url}${headersStr}${bodyStr}`;
            };
            navigator.clipboard.writeText(httpToCurl(req));
          });
        },
      },
    },
    {
      label: "Refresh",
      key: "refresh",
      icon: NIcon({component: Refresh}),
      show: store.requests[id].kind === t.Kind.SQLSource || store.requests[id].kind === t.Kind.HTTPSource,
      on: {
        click: () => {
          if (store.requests[id].kind === t.Kind.SQLSource) {
            fetchTables(id);
          } else if (store.requests[id].kind === t.Kind.HTTPSource) {
            fetchEndpoints(id);
          }
        },
      },
    },
    {
      label: "Delete",
      key: "delete",
      icon: NIcon({color: "red", component: DeleteOutlined}),
      on: {
        click: () => {
          store.deleteRequest(id);
        },
      },
    },
  ];
  const options = preOptions.filter(opt => opt.show !== false).map(opt => {
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
  globalDropdown.show(event.clientX, event.clientY, options);
}
