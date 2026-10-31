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

export const css = Object.assign((s: string | Partial<CSSStyleDeclaration>): string => {
  const decl = typeof s === "string" ? s :
    Object.entries(s)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
      .join("; ");
  const id = genClass();
  append(`.${id} { ${decl} }`);
  return id;
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
