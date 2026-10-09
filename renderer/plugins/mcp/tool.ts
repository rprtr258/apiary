import * as t from "@/types.ts";
import {generateExampleFromSchema} from "@/example.ts";
import {api} from "../../api.ts";
import {m} from "../../lib/utils.ts";
import EditorJSON from "../../components/EditorJSON.ts";
import ViewJSON from "../../components/ViewJSON.ts";
import {NButton, NInputGroup} from "../../components/input.ts";
import {Modal, NSplit} from "../../components/layout.ts";
import {ComponentContainer} from "../../layout/types.ts";
import {NIcon} from "../../components/dataview.ts";
import {QuestionCircleOutlined} from "../../components/icons.ts";
import {type StateMCPItem} from "./index.ts";

// Prompt arguments as a synthetic JSON schema so the editor gets the same
// hints and example generation as tool input schemas
function promptSchema(prompt: t.MCPPrompt): t.JSONSchema {
  return {
    type: "object",
    properties: Object.fromEntries(prompt.arguments.map(arg => [arg.name, {type: "string"}])),
  };
}

export default function ToolViewer(
  container: ComponentContainer,
  {sourceID, item}: StateMCPItem,
): void {
  const el: HTMLElement = container.element;
  el.style.overflow = "hidden";
  const unmounts: (() => void)[] = [];

  const schema = item.kind === "prompt" ? promptSchema(item) : item.inputSchema;
  let args = JSON.stringify(generateExampleFromSchema(schema), null, 2);

  const editor = EditorJSON({
    value: args,
    schema,
    on: {update: (value: string) => {args = value;}},
    style: {height: "100%"},
  });

  const view = ViewJSON(JSON.stringify({status: "waiting"}, null, 2));
  unmounts.push(() => view.unmount());

  async function send() {
    sendButton.el.disabled = true;
    try {
      const parsed: t.JSONValue = (() => {
        const raw = args.trim();
        if (raw === "")
          return null;

        try {
          return JSON.parse(raw) as t.JSONValue;
        } catch (e) {
          view.update(JSON.stringify({error: e instanceof Error ? e.message : String(e)}, null, 2));
        }
        return null;
      })();
      view.update(JSON.stringify({status: "calling"}, null, 2));
      const res = item.kind === "prompt"
        ? await api.mcpCallPrompt(sourceID, item.name, parsed)
        : await api.mcpCallTool(sourceID, item.name, parsed);
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
    title: item.name,
    children: [m("div", {style: {whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "60vh"}}, item.description)],
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
    m("h3", {style: {margin: "0", minWidth: "0"}}, item.name),
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
