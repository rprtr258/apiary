import type {CompletionContext, CompletionResult, CompletionSource} from "@codemirror/autocomplete";
import {ensureSyntaxTree, syntaxTree} from "@codemirror/language";
import type {EditorState} from "@codemirror/state";
import type {SyntaxNode} from "@lezer/common";
import * as t from "@/types.ts";
import {none, Option, some} from "@/option.ts";
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
import {type StateMCPItem} from "./item.ts";

// Prompt arguments as a synthetic JSON schema so the editor gets the same
// hints and example generation as tool input schemas
function promptSchema(prompt: t.MCPPrompt): t.JSONSchema {
  return {
    type: "object",
    properties: Object.fromEntries(prompt.arguments.map(arg => [arg.name, {type: "string"}])),
  };
}

// String values of the object's properties (except `except`), as
// completion/complete context
function stringArgs(state: EditorState, object: SyntaxNode, except: string): Record<string, string> {
  const args: Record<string, string> = {};
  for (let prop = object.firstChild; prop !== null; prop = prop.nextSibling) {
    const key = prop.firstChild;
    const value = prop.lastChild;
    if (prop.name !== "Property" || key === null || key.name !== "PropertyName" || value === null || value.name !== "String")
      continue;
    try {
      const name = JSON.parse(state.doc.sliceString(key.from, key.to)) as string;
      if (name !== except)
        args[name] = JSON.parse(state.doc.sliceString(value.from, value.to)) as string;
    } catch {
      // Strings mid-edit may be invalid JSON; skip them in the context
    }
  }
  return args;
}

// Argument under the caret of an args JSON document: the string value the
// caret sits in, its property name, the other arguments' string values, and
// the content range of the value string
export function promptArgAt(state: EditorState, pos: number): Option<{
  name: string,
  value: string,
  args: Record<string, string>,
  from: number,
  to: number,
}> {
  // ensureSyntaxTree: the initial parse has a 20ms wall-clock budget and may
  // be cut short under load (partial tree => wrong node at the caret)
  const tree = ensureSyntaxTree(state, pos) ?? syntaxTree(state);
  const node = tree.resolveInner(pos, -1);
  // The caret must sit inside a string value whose key names the argument
  if (node.name !== "String" || node.parent?.name !== "Property")
    return none;
  const key = node.parent.firstChild;
  const object = node.parent.parent;
  if (key === null || key.name !== "PropertyName" || object === null)
    return none;
  const from = node.from + 1; // skip the opening quote
  if (pos < from || pos > node.to - 1)
    return none;
  try {
    const name = JSON.parse(state.doc.sliceString(key.from, key.to)) as string;
    return some({
      name,
      value: state.doc.sliceString(from, pos),
      args: stringArgs(state, object, name),
      from,
      to: node.to - 1,
    });
  } catch {
    return none; // key is mid-edit, not a valid string yet
  }
}

// Real MCP completion for prompt arguments: while the caret sits inside a
// prompt argument's string value, ask the server for suggestions with the
// partial value and the other arguments as context
function promptCompletions(sourceID: string, prompt: t.MCPPrompt): CompletionSource {
  // Each query spins up a fresh server connection (per-op reconnect); sleep
  // off the typing so continuous input does not spawn a process per keystroke
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const argOpt = promptArgAt(context.state, context.pos);
    if (argOpt.isNone())
      return null;

    const arg = argOpt.value;
    await new Promise(resolve => setTimeout(resolve, 300));
    if (context.aborted)
      return null;
    const res = await api.mcpComplete(sourceID, {
      ref: {type: "ref/prompt", name: prompt.name},
      argument: {name: arg.name, value: arg.value},
      context: {arguments: arg.args},
    });
    if (res.kind === "err")
      return null;
    return {
      from: arg.from,
      to: arg.to,
      options: res.value.completion.values.map(value => ({label: value})),
    };
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
    completions: item.kind === "prompt" ? [promptCompletions(sourceID, item)] : undefined,
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
