import {api} from "../api.ts";
import {m} from "../lib/utils.ts";
import EditorJSON from "./EditorJSON.ts";
import ViewJSON from "./ViewJSON.ts";
import {NButton, NInputGroup} from "./input.ts";
import {Modal, NSplit} from "./layout.ts";
import {ComponentContainer} from "../layout/types.ts";
import {NIcon} from "./dataview.ts";
import {QuestionCircleOutlined} from "./icons.ts";
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

  const infoModal = Modal({
    title: tool.name,
    children: [m("div", {style: {whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "60vh"}}, tool.description)],
    buttons: [{id: "close", text: "Close"}],
    on: {close: (id?: string) => {
      if (id === "close") infoModal.display = false;
    }},
  });
  // Override the fixed 20% height from style_modal so the modal fits its content.
  Object.assign((infoModal.element.firstElementChild as HTMLElement).style, {
    height: "auto",
    maxHeight: "80vh",
    width: "50%",
  });

  const infoButton = m("span", {
    title: "Show description",
    style: {cursor: "pointer", display: "inline-flex", alignItems: "center", color: "#a0a0a0"},
    onclick: () => {infoModal.display = true;},
  }, NIcon({component: QuestionCircleOutlined}));

  const header = NInputGroup({style: {
    display: "grid",
    gridTemplateColumns: "1fr 10fr 1fr",
  }},
    infoButton,
    m("h3", {style: {margin: "0", minWidth: "0"}}, tool.name),
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
    infoModal.element,
  );

  container.on("destroy", () => {
    for (const unmount of unmounts) {
      unmount();
    }
  });
}
