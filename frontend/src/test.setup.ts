import {Window, Document} from "happy-dom";

declare const globalThis: {
  window: Window,
  document: Document,
  Node: typeof window.Node,
  HTMLElement: typeof window.HTMLElement,
  Event: typeof window.Event,
  Element: typeof window.Element,
};

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.Element = window.Element;
