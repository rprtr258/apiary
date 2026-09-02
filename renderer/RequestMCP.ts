import {NEmpty, StatusLabel} from "./components/dataview.ts";
import ParamsList from "./components/ParamsList.ts";
import {NInput, NInputGroup, NSelect} from "./components/input.ts";
import {get_request} from "./store.ts";
import {api} from "./api.ts";
import {invalidateTools, setTools} from "./sidebar/sourceCache.ts";
import * as t from "@/types.ts";
import {m} from "./lib/utils.ts";

type Request = t.MCPRequest;

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
  const unmounts: (() => void)[] = [];

  return {
    loaded: (r: get_request): void => {
      const requestID = r.request.id;
      const request = r.request as Request;
      const statusLabel = StatusLabel();

      // Check connection by listing tools; status is set from the result.
      // The same result refreshes the sidebar tool cache so it stays in sync
      // with the current server params.
      async function updateConnectionStatus(): Promise<void> {
        const res = await api.mcpListTools(requestID);
        setTools(requestID, res);
        statusLabel.setStatus(res.map_or_else(
          tools => `Connected! ${tools.length} tools available.`,
          err => `Connection failed: ${err}`,
        ), res.kind === "ok");
      };

      async function update_request(patch: Partial<Request>): Promise<void> {
        Object.assign(request, patch);
        await on.update(patch);
        invalidateTools(requestID);
        await updateConnectionStatus();
      };

      const transportSelect = NSelect<t.MCPTransport>({
        label: request.transport,
        options: [
          {label: "stdio", value: "stdio"},
          {label: "http", value: "http"},
          {label: "sse", value: "sse"},
        ],
        on: {update: transport => {
          update_request((() => {
            switch (transport) {
            case "stdio":
              return {transport: "stdio", command: "", args: [], env: []};
            case "http":
            case "sse":
              return request.transport === "stdio" ? {
                transport,
                url: "",
                headers: [],
              } : {
                transport,
                url: request.url,
                headers: request.headers,
              };
            }
          })());
          renderFields();
        }},
      });

      const fieldsContainer = m("div", {style: {display: "flex", flexDirection: "column", gap: ".5em"}});

      // Label and field on one row; labels share a fixed width, field fills the rest.
      function fieldRow(labelText: string, field: HTMLElement): HTMLElement {
        return m("div", {style: {display: "flex", alignItems: "center", gap: ".5em"}},
          m("label", {style: {width: "5em", flexShrink: "0", whiteSpace: "nowrap"}}, labelText),
          field,
        );
      }

      function renderFields(): void {
        fieldsContainer.replaceChildren(...(() => {
          switch (request.transport) {
          case "stdio": {
            const commandInput = NInput({
              placeholder: "bunx",
              value: request.command,
              style: {flex: "1"},
              on: {update: (v: string) => update_request({command: v})},
            });
            const argsInput = NInput({
              placeholder: "-y @modelcontextprotocol/server-filesystem /tmp",
              value: request.args.join(" "),
              style: {flex: "1"},
              on: {update: (v: string) => update_request({args: v.split(" ").map(a => a.trim()).filter(a => a !== "")})},
            });
            const envList = ParamsList({
              value: request.env,
              on: {update: (value: t.KV[]) => update_request({env: value})},
            });
            envList.style.flex = "1";
            return [
              fieldRow("Command", commandInput),
              fieldRow("Args", argsInput),
              fieldRow("Env", envList),
            ];
          }
          case "http":
          case "sse": {
            const urlInput = NInput({
              placeholder: "https://example.com/mcp",
              value: request.url,
              style: {flex: "1"},
              on: {update: (v: string) => update_request({url: v})},
            });
            const headersList = ParamsList({
              value: request.headers,
              on: {update: (value: t.KV[]) => update_request({headers: value})},
            });
            headersList.style.flex = "1";
            return [
              fieldRow("URL", urlInput),
              fieldRow("Headers", headersList),
            ];
          }
          }
        })());
      }

      renderFields();

      transportSelect.el.style.flex = "1";

      const el_connection = NInputGroup({
        style: {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: ".8em",
          padding: "0 3em",
        },
      }, [
        fieldRow("Transport", transportSelect.el),
        fieldsContainer,
        statusLabel.el,
      ]);

      el.replaceChildren(el_connection);
      updateConnectionStatus(); // Initial check
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
};
