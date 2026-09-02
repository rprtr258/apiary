import {ComponentContainer} from "golden-layout";
import {api} from "../api.ts";
import {m} from "../lib/utils.ts";
import EditorJSON from "./EditorJSON.ts";
import ViewJSON from "./ViewJSON.ts";
import {NButton} from "./input.ts";
import {NSplit} from "./layout.ts";
import type {StateMCPTool} from "../store.ts";

export type ToolViewerProps = StateMCPTool;

export default function ToolViewer(
  container: ComponentContainer,
  {sourceID, tool}: ToolViewerProps,
): void {
  const el: HTMLElement = container.element;
  el.style.overflow = "hidden";
  const unmounts: (() => void)[] = [];

  let args = "{}";

  const editor = EditorJSON({
    value: args,
    schema: tool.inputSchema,
    on: {update: (value: string) => {args = value;}},
    style: {height: "100%"},
  });

  const view = ViewJSON(JSON.stringify({status: "waiting"}, null, 2));
  unmounts.push(() => view.unmount());

  async function send() {
    sendButton.el.disabled = true;
    try {
      let parsed: unknown = undefined;
      const raw = args.trim();
      if (raw !== "") {
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          view.update(JSON.stringify({error: e instanceof Error ? e.message : String(e)}, null, 2));
          return;
        }
      }
      view.update(JSON.stringify({status: "calling"}, null, 2));
      const res = await api.mcpCallTool(sourceID, tool.name, parsed);
      if (res.kind === "err") {
        view.update(JSON.stringify({error: String(res.value)}, null, 2));
        return;
      }
      view.update(JSON.stringify(res.value, null, 2));
    } finally {
      sendButton.el.disabled = false;
    }
  };

  const sendButton = NButton({
    primary: true,
    on: {click: send},
  }, "Send");

  const header = m("div", {style: {
    display: "flex",
    alignItems: "center",
    gap: ".5em",
    padding: "8px",
    borderBottom: "1px solid #333",
  }},
    m("div", {style: {flexGrow: "1", minWidth: "0"}},
      m("h3", {style: {margin: "0"}}, tool.name),
      m("div", {style: {color: "#a0a0a0", fontSize: ".85em"}}, tool.description),
    ),
    sendButton.el,
  );

  const split = NSplit(editor, view.el, {
    direction: "horizontal",
    sizes: ["1fr", "1fr"],
  });
  unmounts.push(() => split.unmount());

  el.replaceChildren(
    m("div", {class: "h100", style: {display: "flex", flexDirection: "column"}},
      header,
      m("div", {style: {flexGrow: "1", minHeight: "0"}}, split.element),
    ),
  );

  container.on("destroy", () => {
    for (const unmount of unmounts) {
      unmount();
    }
  });
}
