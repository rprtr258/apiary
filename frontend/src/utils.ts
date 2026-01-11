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
  return n === null ? [] :
    n instanceof Node ? [n] :
    typeof n === "string" ? [n] :
      n.flatMap(flatten);
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
  },
  path: {
    d: string,
    fill: string,
  },
  g: {
    fill: string,
    stroke: string,
    "stroke-linecap": string,
    "stroke-linejoin": string,
    "stroke-width": number,
    "fill-rule": "evenodd" | "nonzero",
  },
}

export function s<K extends keyof SVGAttrs>(
  tag: K,
  props: Partial<SVGAttrs[K]>,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "style") { // inline styles
      Object.assign(el.style, value ?? {});
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    el.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return el;
}

export type Signal<T> = {
  update: (f: (value: T) => T) => void,
  sub: (cb: (value: T, old: T, first: boolean) => void, immediate: boolean) => () => void,
  get value(): T, // TODO: remove?
};
export function signal<T>(value: T): Signal<T> {
  let _value = value;
  const subs = new Set<(value: T, old: T, first: boolean) => void>();
  return {
    sub: (cb, immediate) => {
      subs.add(cb);
      if (immediate)
        cb(_value, undefined as T, true);
      return () => {
        subs.delete(cb);
      };
    },
    update: (f: (value: T) => T) => {
      const value = f(_value);
      if (value === _value) {
        return;
      }
      const old = _value;
      _value = value;
      for (const cb of subs) {
        cb(value, old, false);
      }
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
