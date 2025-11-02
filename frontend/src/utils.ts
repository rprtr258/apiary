import {api} from "./api";
import type {Result} from "./result";
import {ok} from "./result";

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

type BaseDOMNode = HTMLElement | string | SVGSVGElement | null;
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

export function m<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> | Record<string, any> = {},
  ...children: DOMNode[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "style") {
      for (const [k, v] of Object.entries(value ?? {})) {
        el.style.setProperty(k, v as string);
      }
    } else if (key === "innerHTML") {
      el.innerHTML = String(value);
      if (children.length !== 0) {
        throw new Error("Can't use innerHTML with children");
      }
    } else if (key.startsWith("on")) { // event handlers
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === undefined) {
      continue;
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

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  props: Partial<SVGElementTagNameMap[K]> | Record<string, any> = {},
  ...children: (SVGElement | string)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "style") { // inline styles
      for (const [k, v] of Object.entries(value ?? {})) {
        el.style.setProperty(k, v as string);
      }
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
  sub: (cb: (value: T) => void) => void,
};
export function signal<T>(value: T): Signal<T> {
  let _value = value;
  const subs = new Set<(value: T) => void>();
  return {
    sub: (cb) => {
      subs.add(cb);
      cb(_value);
      return () => {
        subs.delete(cb);
      };
    },
    update: (f: (value: T) => T) => {
      const value = f(_value);
      if (value === _value) {
        return;
      }
      _value = value;
      for (const cb of subs) {
        cb(value);
      }
    },
  };
}