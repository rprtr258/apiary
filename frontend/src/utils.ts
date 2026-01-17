import {api} from "./api.ts";
import {Result, ok} from "./result.ts";

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

type ElementProps<K extends keyof HTMLElementTagNameMap> =
  Partial<Omit<
    HTMLElementTagNameMap[K],
    "style" | "children" | "innerHTML"
  >> & {
    class?: string,
    style?: Partial<CSSStyleDeclaration>,
    innerHTML?: string,
  };

export function m<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  preProps?: ElementProps<K>,
  ...children: DOMNode[]
): HTMLElementTagNameMap[K] {
  const props: ElementProps<K> = preProps ?? {};
  const el = document.createElement(tag);
  Object.assign(el.style, props.style ?? {});
  if (props.innerHTML !== undefined) {
      el.innerHTML = props.innerHTML;
      if (children.length !== 0) {
        throw new Error("Can't use innerHTML with children");
      }
  }
  for (const [key, value] of Object.entries(props)) {
    if (key === "style" || key === "innerHTML" || value === undefined) {
      continue;
    }
    if (key.startsWith("on")) { // event handlers
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListenerOrEventListenerObject);
    } else if (typeof value === "object") {
      throw new Error(`Can't set element property "${key}" to ${JSON.stringify(value)}`);
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of flatten(children)) {
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
    "stroke-linecap": string,
    "stroke-linejoin": string,
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
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    el.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return el;
}

type Sub<T> = Generator<undefined, never, T>;
export type Signal<T> = {
  update(f: (value: T) => T): void,
  sub(sub: Sub<T>): () => void,
  get value(): T, // TODO: remove?
};
export function signal<T>(value: T): Signal<T> {
  let _value = value;
  const subs = new Set<Sub<T>>();
  return {
    sub(g) {
      subs.add(g);
      if (g.next(_value).done === true) { subs.delete(g); return () => {}; } // NOTE: run until first yield
      if (g.next(_value).done === true) { subs.delete(g); return () => {}; } // NOTE: trigger first yield
      return () => subs.delete(g);
    },
    update(f: (value: T) => T) {
      const value = f(_value);
      if (value === _value)
        return;
      _value = value;
      for (const sub of subs)
        sub.next(value);
    },
    get value(): T {return _value;},
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
