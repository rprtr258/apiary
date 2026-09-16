import {css} from "./styles.ts";
import {m} from "./utils.ts";
import {Cross} from "../components/icons.ts";
import {NIcon} from "../components/dataview.ts";

function formatValue(v: unknown): string {
  switch (typeof v) {
  case "string":
    return v;
  case "object":
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      console.error("unprintable notification value", v);
      return "";
    }
  default:
    return String(v);
  }
}

type VariantClasses = {
  item: string,
  dot: string,
  bar: string,
};

function variantClasses(accent: string): VariantClasses {
  return {
    item: css(`border-left-color: ${accent};`),
    dot: css(`background: ${accent};`),
    bar: css(`background: ${accent};`),
  };
}

const TOAST_MS = 5000;

const classes = {
  common: {
    item: css(`
      position: relative;
      box-sizing: border-box;
      max-width: 360px;
      padding: 10px 28px 10px 12px;
      border-radius: 6px;
      background: #1a1a1f;
      border: 1px solid #2a2a30;
      border-left: 3px solid transparent;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
      transition: opacity 150ms ease;
    `),
    dot: css(`
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    `),
    bar: css.raw(`{
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 2px;
      border-radius: 0 0 4px 4px;
      transform: scaleX(0);
      transform-origin: left;
      animation: toast-timer ${TOAST_MS}ms linear forwards;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
    @keyframes toast-timer {
      from {transform: scaleX(0);}
      to   {transform: scaleX(1);}
    }`),
  },
  variants: {
    error: variantClasses("#b91c1c"),
    warning: variantClasses("#d97706"),
    info: variantClasses("#5a8ab5"),
  },
  text: css(`
    margin-top: 4px;
    max-height: 45vh;
    overflow-y: auto;
    white-space: pre-line;
    word-break: break-word;
    color: #a0a0a0;
    font-size: 12px;
    line-height: 1.45;
  `),
  close: css(`
    position: absolute;
    top: 6px;
    right: 8px;
    padding: 0 2px;
    border: none;
    background: none;
    cursor: pointer;
    color: #666;
    font-size: 13px;
    line-height: 1;
  `),
  box: css(`
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `),
  hide: css(`opacity: 0;`),
  title: css(`
    display: flex;
    align-items: center;
    gap: 7px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
  `),
};

let box: HTMLElement | undefined;
export default (
  variant: keyof typeof classes.variants,
  title: string,
  args: Record<string, unknown>,
): void => {
  if (box === undefined) {
    box = m("div", {class: classes.box});
    document.body.appendChild(box);
  }

  const classesV = classes.variants[variant];
  const content = Object
    .entries(args)
    .map(([k, v]) => [k, formatValue(v)])
    .map(([k, v]) => `${["error", "content"].includes(k) ? "" : `${k}: `}${v}`)
    .join("\n");
  const bar = m("div", {class: [classes.common.bar, classesV.bar].join(" ")});
  const el = m("div", {class: [classes.common.item, classesV.item].join(" ")},
    m("div", {class: classes.title}, m("span", {class: [classes.common.dot, classesV.dot].join(" ")}), title),
    Object.keys(args).length > 0 ? m("div", {class: classes.text}, content) : null,
    m("button", {class: classes.close, onclick: () => el.remove()}, NIcon({component: Cross})),
    bar,
  );
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add(classes.hide);
    setTimeout(() => el.remove(), 150);
  }, TOAST_MS);
};
