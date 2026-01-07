import {EditorState} from "@codemirror/state";
import {EditorView, ViewPlugin, ViewUpdate} from "@codemirror/view";
import {markdown} from "@codemirror/lang-markdown";
import {database} from "../wailsjs/go/models.ts";
import {NEmpty} from "./components/dataview.ts";
import {NSplit} from "./components/layout.ts";
import {defaultEditorExtensions, defaultExtensions} from "./components/editor.ts";
import {get_request} from "./store.ts";
import {api, HistoryEntry} from "./api.ts";
import {m, Signal} from "./utils.ts";

type Request = {kind: database.Kind.MD} & database.MDRequest;

type Props = {
  value: string | null,
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
};
function EditorMD(props: Props) {
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

  const editor = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: props.value ?? "",
      extensions: [
        ...defaultExtensions,
        ...defaultEditorExtensions(() => {}), // empty function because updateListener handles changes
        markdown(),
        updateListener,
      ],
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
  push_history_entry(he: HistoryEntry): void, // show last history entry
  unmount(): void,
} {
  el.append(NEmpty({
    description: "Loading request...",
    class: "h100",
    style: {justifyContent: "center"},
  }));

  const el_response = NEmpty({
    description: "Send request or choose one from history.",
    class: "h100",
    style: {justifyContent: "center"},
  });
  const unmounts: (() => void)[] = [];

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

  let id: string | null = null;
  let responseContainer: HTMLElement | null = null;
  let lastScrollTop = 0;

  const update_response = () => {
    if (id === null) return; // Guard: id not set yet
    api.requestPerform(id).then(res => {
      if (res.kind === "err") {
        el_error.textContent = `Could not render document: ${res.value}`;
        el_error.style.display = "block";
      } else {
        el_error.style.display = "none";
        const response = res.value.response as database.MDResponse;

         // Save scroll position before update
        if (responseContainer !== null) {
          lastScrollTop = responseContainer.scrollTop;
        }

         // Create a new container with the result
        const newContainer = m("div", {
          class: "h100 markdown-body",
          style: {
            overflowY: "scroll",
          },
          innerHTML: response.data,
        });

          // Restore scroll position after rendering
          requestAnimationFrame(() => {
            newContainer.scrollTop = lastScrollTop;
          });

        responseContainer = newContainer;
        el_response.replaceChildren(newContainer);
      }
    }).catch(alert);
  };

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      id = r.request.id;

      update_response();

      const {el: el_editor_md, editor} = EditorMD({
        value: request.data,
        on: {
          update: async (data: string) => {
            await on.update({data});
            update_response();
          },
        },
        class: "h100",
        style: {
          minHeight: "0",
        },
      });
      unmounts.push(() => editor.destroy());

      const updateLayout = (show_request: boolean) => {
        if (show_request) {
          const right_div = m("div", {
            class: "h100",
            style: {
              display: "flex",
              flexDirection: "column",
              minHeight: "0",
            },
          },
            el_error,
            el_response,
          );
          el.replaceChildren(NSplit(el_editor_md, right_div, {direction: "horizontal"}));
        } else {
          el.replaceChildren(m("div", {
            class: "h100",
            style: {
              display: "grid",
              gridTemplateColumns: "1fr",
              gridTemplateRows: "1fr",
            },
          },
            m("div", {
              class: "h100",
              style: {
                display: "flex",
                flexDirection: "column",
              },
            },
              el_error,
              el_response,
            ),
          ));
        }
      };
      unmounts.push(show_request.sub(updateLayout));
    },
    push_history_entry(_he) {
      if (id === null) return; // Guard: id not set yet
      update_response();
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
