import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import * as t from "@/types.ts";
import {ComponentContainer} from "../../layout/types.ts";
import {api} from "../../api.ts";
import {defaultExtensions} from "../../components/editor.ts";
import {m} from "../../lib/utils.ts";

export const componentType = "ResourceViewer";

export type StateMCPResource = {
  sourceID: string,
  itemKey: string,
  resource: t.MCPResource,
};

// Read-only pane for a listed MCP resource: fetches the current content via
// resources/read and shows it in a non-editable editor (text entries as-is,
// blob entries as base64)
export default function ResourceViewer(
  container: ComponentContainer,
  {sourceID, resource}: StateMCPResource,
): void {
  const el: HTMLElement = container.element;
  el.style.overflow = "hidden";

  function update(doc: string): void {
    editor.dispatch({
      changes: {from: 0, to: editor.state.doc.length, insert: doc},
    });
  }

  const editorEl = m("div", {style: {minHeight: "0", flexGrow: "1"}});
  const editor = new EditorView({
    parent: editorEl,
    state: EditorState.create({
      doc: "Loading...",
      extensions: [
        ...defaultExtensions,
        EditorState.readOnly.of(true),
      ],
    }),
  });

  api.mcpReadResource(sourceID, resource.uri).then(res => {
    if (res.kind === "err") {
      update(String(res.value));
      return;
    }
    update(res.value.contents.map(c => c.text !== "" ? c.text : c.blob).join("\n"));
  });

  el.replaceChildren(m("div", {class: "h100", style: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
  }}, editorEl));

  container.on("destroy", () => {
    editor.destroy();
  });
}
