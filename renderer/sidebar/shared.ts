import * as t from "@/types.ts";
import {clamp, m, setDisplay, signal} from "../lib/utils.ts";

export function badge(kind: t.Kind): [string, string] {
  switch (kind) {
  case t.Kind.HTTP:       return ["HTTP",       "lime"     ];
  case t.Kind.SQL:        return ["SQL",        "lightblue"];
  case t.Kind.GRPC:       return ["GRPC",       "cyan"     ];
  case t.Kind.HTTPSource: return ["HTTP*",      "lime"     ];
  case t.Kind.JQ:         return ["JQ",         "violet"   ];
  case t.Kind.REDIS:      return ["REDIS",      "red"      ];
  case t.Kind.MD:         return ["MD",         "blue"     ];
  case t.Kind.SQLSource:  return ["SQL*",       "blue"     ];
  case t.Kind.DIFF:       return ["DIFF",       "green"    ];
  default:                return [String(kind), ""         ];
  }
}

type Kind = typeof t.Kinds[number];
export const newRequestKind = signal<Kind | undefined>(undefined);
export const newRequestName = signal<string | undefined>(undefined);
export const renameID = signal<string | undefined>(undefined);
export const renameValue = signal<string | undefined>(undefined);
export function renameInit(id: string) {
  renameID.update(() => id);
  renameValue.update(() => id);
}

export const sidebarHidden = signal(false);

function cutEnd(str: string, suffix: string) {
  if (!str.endsWith(suffix))
    throw new Error(`String ${str} does not end with ${suffix}`);
  return str.slice(0, -suffix.length);
}

function Dropdown() {
  const open = signal(false);
  const el: HTMLElement = m("div", {style: {
    position: "fixed",
    zIndex: "1000",
    background: "#2a2a2a",
    color: "#ffffff",
    border: "1px solid #404040",
    borderRadius: "4px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
    minWidth: "120px",
  }});
  open.sub(function*() {while(true) setDisplay(el, yield);}());
  document.addEventListener("click", e => {
    if (!el.contains(e.target as Node))
      open.update(() => false);
  });

  return {
    el,
    show(
      [x, y]: [number, number],
      options: HTMLElement[],
    ) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      el.replaceChildren(...options);
      open.update(() => true);

      // NOTE: we can go out of window (literally),
      // so we have to adjust dropdown position to be inside if possible
      {
        const x = clamp(parseFloat(cutEnd(el.style.left, "px")), 0, window.innerWidth - el.offsetWidth);
        const y = clamp(parseFloat(cutEnd(el.style.top, "px")), 0, window.innerHeight - el.offsetHeight);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
    },
    hide() {
      open.update(() => false);
    },
  };
}

export const globalDropdown = Dropdown();
