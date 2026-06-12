import {Window, Document} from "happy-dom";

// happy-dom on Bun does not expose native error constructors on Window.
// Set them here so happy-dom internals can instantiate them.
function patchWindow(w: Window): void {
  w.SyntaxError = SyntaxError;
}

declare const globalThis: {
  window: Window,
  document: Document,
  localStorage: Storage,
  MutationObserver: typeof window.MutationObserver,
  Node: typeof window.Node,
  HTMLElement: typeof window.HTMLElement,
  Event: typeof window.Event,
  Element: typeof window.Element,
};

const window = new Window();
patchWindow(window);
globalThis.window = window;
// happy-dom defaults to "about:blank", which breaks @apidevtools/json-schema-ref-parser's
// URL resolution (cwd() checks window.location.href before process.cwd()).
// Set a valid HTTP URL so relative URL resolution works.
window.location.href = "http://localhost/"; // TODO: remove this parasha
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.MutationObserver = window.MutationObserver;
globalThis.Node = window.Node;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.Element = window.Element;