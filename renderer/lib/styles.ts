import {installTheme} from "./theme.ts";

installTheme();

let style: Element | null = null;
function getStyle(): Element {
  if (style !== null)
    return style;

  style = document.querySelector("#dynamic-styles");
  if (style !== null)
    return style;

  style = document.createElement("style");
  style.id = "dynamic-styles";
  document.head.appendChild(style);
  return style;
}

function append(s: string): void {
  getStyle().textContent += s + "\n";
}

let nextID = -1;
function genClass(): string {
  nextID++;
  return `z${nextID}`;
}

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

type StyleDeclarations = string | Partial<CSSStyleDeclaration>;

function declarations(s: StyleDeclarations): string {
  return typeof s === "string" ? s :
    Object.entries(s)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
      .join("; ");
}

export const css = Object.assign((s: StyleDeclarations, extra?: Record<string, StyleDeclarations>): string => {
  const cls = genClass();
  const decl = declarations(s);
  if (decl !== "")
    append(`.${cls} { ${decl} }`);
  for (const [selector, block] of Object.entries(extra ?? {})) {
    const decl = declarations(block);
    if (decl !== "")
      append(`.${cls}${selector} { ${decl} }`);
  }
  return cls;
}, {
  raw(s: string): string {
    const id = genClass();
    append(`.${id}${s}`);
    return id;
  },
});

// classList.toggle accepts a single token; css()+css.raw() chains are
// space-separated multi-token strings.
export function setClass(el: HTMLElement, on: boolean, ...cls: string[]): void {
  for (const token of cls) {
    el.classList.toggle(token, on);
  }
}

export type Size = 1 | 2 | 3 | 4 | 5;
export const sizes: Size[] = [1, 2, 3, 4, 5];
