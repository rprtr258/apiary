import * as t from "@/types.ts";
import notification from "../../lib/notification.ts";
import {api} from "../../api.ts";
import {NIcon} from "../../components/dataview.ts";
import {ContentCopyFilled} from "../../components/icons.ts";
import {MenuOption, Plugin} from "../types.ts";
import RequestHTTP from "./viewer.ts";

function httpToCurl({url, method, body, headers}: t.HTTPRequest): string {
  const headersStr = headers.length > 0 ? " " + headers.map(({key, value}) => `-H "${key}: ${value}"`).join(" ") : "";
  const bodyStr = body !== "" ? ` -d '${body}'` : "";
  return `curl -X ${method} ${url}${headersStr}${bodyStr}`;
}

const copyAsCurl = (id: string): MenuOption => ({
  label: "Copy as curl",
  key: "copy-as-curl",
  icon: NIcon({component: ContentCopyFilled}),
  on: {
    click: () => {
      api.get(id).then(r => {
        if (r.kind === "err") {
          notification("error", "Error", {content: `Failed to load request: ${r.value}`});
          return;
        }

        const req = r.value.Request as unknown as t.HTTPRequest; // TODO: remove unknown cast
        navigator.clipboard.writeText(httpToCurl(req));
      });
    },
  },
});

export const httpPlugin: Plugin = {
  kind: t.Kind.HTTP,
  kindTag: {text: "HTTP", color: "lime", type: "success"},
  frame: (args) => RequestHTTP(args.el, args.show_request, args.on),
  menuEntries: (id: string) => [copyAsCurl(id)],
};
