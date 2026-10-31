import {m, DOMNode} from "../lib/utils.ts";
import {css, Size, setClass, sizes} from "../lib/styles.ts";

// Input element (default variant) ported onto the native controls.
// border-box pins the outer height to var(--input-height) so inputs match
// adjacent buttons/selects; the UA default was observed to resolve to
// content-box in some documents, making inputs 2px+ taller than buttons.
// No width here: sizing must come from the parent's default grid/flex
// stretch; a 100% width would also overflow its grid track by the padding.
export const inputBase = [
  css({
    appearance: "none",
    boxSizing: "border-box",
    resize: "none",
    display: "block",
    transition: "border-color 100ms ease",
    textAlign: "left",
    color: "var(--color-text)",
    border: "1px solid var(--color-dark-4)",
    backgroundColor: "var(--color-dark-6)",
    fontFamily: "inherit",
    height: "var(--input-height)",
    minHeight: "var(--input-height)",
    lineHeight: "calc(var(--input-height) - 2px)",
    fontSize: "var(--input-fz, var(--font-size-2))",
    borderRadius: "var(--input-radius)",
    paddingInline: "calc(var(--input-height) / 3)",
    cursor: "text",
  }),
  css.raw(":focus{outline:none; border-color:var(--primary-color-filled);}"),
  css.raw("::placeholder{color:var(--color-placeholder); opacity:1;}"),
  css.raw(":disabled{cursor:not-allowed; opacity:0.6; background-color:var(--color-disabled); color:var(--color-disabled-color);}"),
  css.raw("::-webkit-inner-spin-button,::-webkit-outer-spin-button,::-webkit-search-decoration,::-webkit-search-cancel-button,::-webkit-search-results-button,::-webkit-search-results-decoration{appearance:none;}"),
].join(" ");

const inputStyles = {
  error: [
    css({borderColor: "var(--color-error)", backgroundColor: "var(--color-red-light)"}),
    css.raw(":focus{border-color: var(--color-error);}"),
  ],
  success: [
    css({borderColor: "var(--color-teal-8)", backgroundColor: "var(--color-teal-light)"}),
    css.raw(":focus{border-color: var(--color-teal-8);}"),
  ],
};

const inputSizeStyles: Map<Size, Partial<CSSStyleDeclaration>> = new Map(sizes.map(size => [size, {
  "--input-height": `var(--input-height-${size})`,
  "--input-fz": `var(--font-size-${size})`,
}]));
// The size prop resolves into inline --input-height/--input-fz
// variables; the base class and everything derived from it (padding, line
// height, select chevron placement) are written against those variables.
export function sizeStyle(size: Size | undefined): Partial<CSSStyleDeclaration> {
  if (size === undefined) {
    return {};
  }
  return inputSizeStyles.get(size)!;
}

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error",
  value?: string,
  size?: Size,
  on?: {
    update: (value: string) => void,
    keydown?: (e: KeyboardEvent) => void,
    blur?: () => void,
  },
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  autofocus?: boolean,
};
export function NInput(props: NInputProps) {
  const el = m("input", {
    class: inputBase,
    style: {...sizeStyle(props.size), ...props.style},
    value: props.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => props.on?.update((e.target as HTMLInputElement).value),
    onkeydown: props.on?.keydown,
    onblur: props.on?.blur,
    disabled: props.disabled,
  });

  // Invalid/success are driven from static [data-error]/[data-invalid]
  // state; apply on creation and re-evaluate on focus.
  const applyStatus = (): void => {
    setClass(el, props.status === "error", ...inputStyles.error);
    setClass(el, props.status === "success", ...inputStyles.success);
  };
  applyStatus();
  el.addEventListener("focus", applyStatus);

  if (props.autofocus ?? false) {
    queueMicrotask(() => el.focus());
  }

  return el;
}

// Input group: children join (square inner ends, half-width shared
// borders) and the focused child keeps its full border above the overlap.
const groupBase = [
  css("--ai-border-width:1px; display:flex;"),
  css.raw(" :where(*):focus{position:relative; z-index:1;}"),
  css.raw(" > *:not(:only-child):first-child{border-start-end-radius:0; border-end-end-radius:0; border-inline-end-width:calc(var(--ai-border-width) / 2);}"),
  css.raw(" > *:not(:only-child):last-child{border-start-start-radius:0; border-end-start-radius:0; border-inline-start-width:calc(var(--ai-border-width) / 2);}"),
  css.raw(" > *:not(:only-child):not(:first-child):not(:last-child){border-radius:0; border-inline-width:calc(var(--ai-border-width) / 2);}"),
].join(" ");

export function NInputGroup(props: {style: Partial<CSSStyleDeclaration>}, ...children: DOMNode[]) {
  return m("div", {...props, class: groupBase}, children);
}
