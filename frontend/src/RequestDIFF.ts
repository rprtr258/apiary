import {EditorState, RangeSetBuilder} from "@codemirror/state";
import {EditorView, ViewPlugin, ViewUpdate, Decoration} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {database} from "../wailsjs/go/models.ts";
import {NEmpty} from "./components/dataview.ts";
import {NSplit} from "./components/layout.ts";
import {defaultEditorExtensions, defaultExtensions} from "./components/editor.ts";
import {get_request} from "./store.ts";
import {HistoryEntry} from "./types.ts";
import {api} from "./api.ts";
import {m, Signal} from "./utils.ts";
import {css} from "./styles.ts";

// Add diff highlighting CSS styles
const diffAddedLineCl = css(`
  background-color: rgba(0, 255, 0, 0.1);
`);
const diffRemovedLineCl = css(`
  background-color: rgba(255, 0, 0, 0.1);
`);
const diffUpdatedLineCl = css(`
  background-color: rgba(255, 255, 0, 0.1);
`);
const diffContextLineCl = css(`
  background-color: transparent;
`);

// Diff highlighting decorations
const diffAddedLine   = Decoration.line({attributes: {class: diffAddedLineCl}});
const diffRemovedLine = Decoration.line({attributes: {class: diffRemovedLineCl}});
const diffUpdatedLine = Decoration.line({attributes: {class: diffUpdatedLineCl}});
const diffContextLine = Decoration.line({attributes: {class: diffContextLineCl}});

function diffHighlighting(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const {from, to} of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const lines = text.split("\n");
    let pos = from;

    for (const line of lines) {
      const lineStart = pos;
      const lineEnd = lineStart + line.length;

      // Check for diff markers
      builder.add(lineStart, lineStart, (() => {
        if (line.startsWith("+") && !line.startsWith("+++")) { // Added line (green)
          return diffAddedLine;
        } else if (line.startsWith("-") && !line.startsWith("---")) { // Removed line (red)
          return diffRemovedLine;
        } else if (line.includes("→") || line.includes("~") || line.includes("*")) { // Updated line (yellow/orange)
          return diffUpdatedLine;
        } else if (line.includes(": +") || (line.includes("+") && line.includes(":"))) { // Added property in JSON diff (green)
          return diffAddedLine;
        } else if (line.includes(": -") || (line.includes("-") && line.includes(":"))) { // Removed property in JSON diff (red)
          return diffRemovedLine;
        } else { // Context line (default)
          return diffContextLine;
        }
      })());

      pos = lineEnd + 1; // +1 for newline character
    }
  }

  return builder.finish();
}

const diffHighlightExtension = EditorView.decorations.of(diffHighlighting);

type Request = {kind: database.Kind.DIFF} & database.DIFFRequest;

type EditorDiffProps = {
  value: string | null,
  on: { update: (value: string) => void },
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  language?: "json" | "text",
};

function EditorDiff(props: EditorDiffProps) {
  const el = m("div", {
    class: props.class,
    style: props.style ?? {},
  });

  const updateListener = ViewPlugin.fromClass(class {
    update(update: ViewUpdate) {
      if (update.docChanged) {
        props.on.update(update.state.doc.toString());
      }
    }
  });

  const extensions = [
    ...defaultExtensions,
    ...defaultEditorExtensions(() => {}),
    updateListener,
    json(), // Always use JSON highlighting for DIFF inputs
  ];

  const editor = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: props.value ?? "",
      extensions,
    }),
  });

  return {el, editor};
}

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  const el_error = m("div", {
    style: {
      display: "none",
      background: "rgba(239, 68, 68, 0.15)",
      color: "#fca5a5",
      borderLeft: "3px solid #ef4444",
      padding: "0.5em 0.75em",
      fontSize: "0.875em",
      fontWeight: "500",
      marginBottom: "0.5em",
    },
  });

  let id: string | undefined = undefined;
  let diffEditor: EditorView | null = null;

  const unmounts: (() => void)[] = [];
  let updateTimeout: number | null = null;

  const update_diff = () => {
    if (id === undefined) return;

    if (updateTimeout !== null) {
      window.clearTimeout(updateTimeout);
    }

    updateTimeout = window.setTimeout(() => {
      api.requestPerform(id!).then(res => {
        if (res.kind === "err") {
          el_error.textContent = `Could not compute diff: ${res.value}`;
          el_error.style.display = "block";
        } else {
          el_error.style.display = "none";
          const response = res.value.response as database.DIFFResponse;

          // Update diff editor
          if (diffEditor !== null) {
            diffEditor.dispatch({
              changes: {
                from: 0,
                to: diffEditor.state.doc.length,
                insert: response.diff,
              },
            });
          }
        }
      }).catch(alert);
    }, 500); // 500ms debounce
  };

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      id = r.request.id;

      // Create left editor
      const {el: el_editor_left, editor: editor_left} = EditorDiff({
        value: request.left,
        on: {
          update: async (left: string) => {
            await on.update({left});
            update_diff();
          },
        },
        class: "h100",
        style: {minHeight: "0"},
      });
      unmounts.push(() => editor_left.destroy());

      // Create right editor
      const {el: el_editor_right, editor: editor_right} = EditorDiff({
        value: request.right,
        on: {
          update: async (right: string) => {
            await on.update({right});
            update_diff();
          },
        },
        class: "h100",
        style: {minHeight: "0"},
      });
      unmounts.push(() => editor_right.destroy());

      // Create vertical split for left editors
      const leftSplit = NSplit(el_editor_left, el_editor_right, {direction: "vertical"});
      unmounts.push(() => leftSplit.unmount());

      // Create diff editor (readonly)
      const el_diff_container = m("div", {
        class: "h100",
        style: {minHeight: "0"},
      });

      const diffExtensions = [
        ...defaultExtensions,
        ...defaultEditorExtensions(() => {}),
        EditorState.readOnly.of(true),
        diffHighlightExtension,
      ];

      diffEditor = new EditorView({
        parent: el_diff_container,
        state: EditorState.create({
          doc: "",
          extensions: diffExtensions,
        }),
      });
      unmounts.push(() => diffEditor?.destroy());

      // Create main split (editors left, diff output right)
      const mainSplit = NSplit(leftSplit.element, el_diff_container, {direction: "horizontal"});
      unmounts.push(() => mainSplit.unmount());
      unmounts.push(show_request.sub(function*() {
        while (true) {
          const show_request = yield;
          mainSplit.leftVisible = show_request;
        }
      }()));

      // Create container with error message above split
      const container = m("div", {class: "h100", style: {display: "flex", flexDirection: "column", minHeight: "0"}},
        el_error,
        mainSplit.element,
      );

      el.replaceChildren(container);
      update_diff(); // Initial diff
    },

    push_history_entry(_he: HistoryEntry) {
      // No history storage for DIFF plugin
    },

    unmount() {
      if (updateTimeout !== null) {
        window.clearTimeout(updateTimeout);
      }
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}