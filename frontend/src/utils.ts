import {Option, some, none} from "./option.ts";
import {Result, ok} from "./result.ts";
import {api} from "./api.ts";

export function arrayGet<T>(items: T[], index: number): Option<T> {
  return index >= 0 && index < items.length ? some(items[index]) : none;
}

function formatResponse(response: string): string {
  const value = ((): unknown => {
    try {
      return JSON.parse(response);
    } catch {
      return null;
    }
  })();
  if (value === null) {
    return response;
  }
  return JSON.stringify(value, null, 2);
}

export async function transform(body: string, query: string): Promise<Result<string>> {
  if (query === "") {
    return ok(formatResponse(body));
  }

  const res = await api.jq(body, query);
  return res.map((item: readonly string[]) => item.map(v => formatResponse(v)).join("\n"));
};

type BaseDOMNode = HTMLElement | SVGSVGElement | string | null;
export type DOMNode = BaseDOMNode | DOMNode[];

export function clone(n: DOMNode): DOMNode {
  return n === null ? null :
    n instanceof Node ? n.cloneNode(true) as DOMNode :
    typeof n === "string" ? n :
      n.map(clone);
}

function flatten(n: DOMNode): BaseDOMNode[] {
  switch (true) {
    case n === null: return [];
    case n instanceof Node: return [n];
    case typeof n === "string": return [n];
    default: return n.flatMap(flatten);
  }
}

export type ElementProps<K extends keyof HTMLElementTagNameMap> =
  Partial<Omit<
    HTMLElementTagNameMap[K],
    "style" | "children" | "innerHTML"
  >> & {
    class?: string,
    style?: Partial<CSSStyleDeclaration>,
    innerHTML?: string,
    "data-testid"?: string,
  } & {
    [key: `data-${string}`]: string,
    [key: `aria-${string}`]: string,
    [key: string]: unknown, // Allow any other string key for custom attributes
  };

// Overload for when props are provided
export function m<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps<K>,
  ...children: DOMNode[]
): HTMLElementTagNameMap[K];

// Overload for when props are omitted
export function m<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  ...children: DOMNode[]
): HTMLElementTagNameMap[K];

// Implementation
export function m<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  preProps?: ElementProps<K> | DOMNode,
  ...children: DOMNode[]
): HTMLElementTagNameMap[K] {
  let props: ElementProps<K>;
  let actualChildren: DOMNode[];

  if (preProps === undefined || preProps === null || typeof preProps === "object") {
    // preProps is ElementProps<K> or undefined or null
    props = preProps !== undefined && preProps !== null ? (preProps as ElementProps<K>) : {};
    actualChildren = children;
  } else {
    // preProps is actually a child
    props = {};
    actualChildren = [preProps as DOMNode, ...children];
  }

  const el = document.createElement(tag);
  Object.assign(el.style, props.style ?? {});
  if (props.innerHTML !== undefined) {
      el.innerHTML = props.innerHTML;
      if (actualChildren.length !== 0) {
        throw new Error("Can't use innerHTML with children");
      }
  }
  for (const [key, value] of Object.entries(props)) {
    if (key === "style" || key === "innerHTML" || value === undefined || value === null) {
      continue;
    }
    if (key.startsWith("on")) { // event handlers
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListenerOrEventListenerObject);
    } else if (typeof value === "object") {
      throw new Error(`Can't set element property "${key}" to ${JSON.stringify(value)}`);
    } else {
      el.setAttribute(key, (value as string | number | boolean).toString());
    }
  }
  for (const child of flatten(actualChildren)) {
    if (child === null) {
      continue;
    }
    el.append(
      child instanceof Node ? child :
      typeof child === "string" ? document.createTextNode(child) :
        child[0]);
  }
  return el;
}

interface SVGCommon {
  id: string,
  style: Partial<CSSStyleDeclaration>,
  class: string,
  transform: string,
  fill: string,
  stroke: string,
  "stroke-width": number,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
}

interface SVGAttrs {
  svg: {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: string, // TODO: DOMRect
    width: string,
    height: string,
    "aria-label": string,
    role: "img",
    style: Partial<CSSStyleDeclaration>,
  } & SVGCommon,
  path: {
    d: string,
    "marker-end": string,
  } & SVGCommon,
  g: {
    "fill-rule": "evenodd" | "nonzero",
  } & SVGCommon,
  rect: {
    x: string,
    y: string,
    width: string,
    height: string,
    rx: string,
  } & SVGCommon,
  circle: {
    cx: string,
    cy: string,
    r: string,
  } & SVGCommon,
  polygon: {
    points: string,
  } & SVGCommon,
  line: {
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    "marker-end": string,
  } & SVGCommon,
  text: {
    x: string,
    y: string,
    "font-family": "monospace",
    "font-size": string,
    "text-anchor": "middle",
  } & SVGCommon,
  defs: {} & SVGCommon,
  pattern: {
    x: string,
    y: string,
    width: string,
    height: string,
    patternUnits: "userSpaceOnUse",
    patternTransform: string,
  } & SVGCommon,
  marker: {
    markerWidth: string,
    markerHeight: string,
    refX: string,
    refY: string,
    orient: string,
  } & SVGCommon,
}

export function s<K extends keyof SVGAttrs>(
  tag: K,
  props: Partial<SVGAttrs[K]>,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "style") { // inline styles
      Object.assign(el.style, value);
    } else if (value === undefined || value === null) {
      continue;
    } else if (typeof value === "object") {
      throw new Error(`Can't set SVG attribute "${key}" to ${JSON.stringify(value)}`);
    } else {
      el.setAttribute(key, (value as string | number | boolean).toString());
    }
  }
  for (const child of children) {
    el.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return el;
}

export function deepEquals<T>(a: T, b: T): boolean {
  if (a === b)
    return true;
  if (Number.isNaN(a) && Number.isNaN(b))
    return true;

  if (typeof a !== "object" || a === null ||
      typeof b !== "object" || b === null)
    return false;

  if (a.constructor !== b.constructor)
    return false;

  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length)
    return false;

  for (const key of keysA) {
    if (!b.hasOwnProperty(key)) return false;
    // @ts-expect-error ts sosal
    if (!deepEquals(a[key], b[key])) return false;
  }

  return true;
}

type Sub<T> = Generator<undefined, never, T>;
export type Signal<T> = {
  update(updater: (current: T) => T): void,
  subCallback(callback: (value: T) => void): () => void,
  sub(generator: Sub<T>): () => void,
  get value(): T,
  set value(newValue: T),
};
export function signal<T>(initialValue: T): Signal<T> {
  let _value = initialValue;
  const callbacks = new Set<(value: T) => void>();
  const generators = new Set<Sub<T>>();

  const notifyAll = (newValue: T): void => {
    // Notify callbacks
    for (const callback of callbacks) callback(newValue);

    // Notify generators
    for (const generator of generators) generator.next(newValue);
  };

  return {
    // Subscribe with callback
    subCallback(callback: (value: T) => void): () => void {
      callbacks.add(callback);
      callback(_value); // Call immediately with current value
      return () => callbacks.delete(callback);
    },

    // Subscribe with generator (legacy API)
    sub(g: Sub<T>): () => void {
      generators.add(g);
      g.next(_value); // Initial yield
      g.next(_value); // Trigger first yield
      return () => generators.delete(g);
    },

    update(updater: (current: T) => T): void {
      const newValue = updater(_value);
      if (newValue === _value) return;

      _value = newValue;
      notifyAll(newValue);
    },

    get value(): T {return _value;},

    set value(newValue: T) {
      if (newValue === _value) return;
      _value = newValue;
      notifyAll(newValue);
    },
  };
}
type ToggleDisplayElement = HTMLElement & {
  __prevDisplay?: string,
};

export function setDisplay(el: ToggleDisplayElement, show: boolean): void {
  if (show) {
    if (el.__prevDisplay !== undefined) {
      el.style.display = el.__prevDisplay;
      delete el.__prevDisplay;
    }
    return;
  }

  if (el.__prevDisplay === undefined) {
    el.__prevDisplay = el.style.display;
    el.style.display = "none";
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
