import {m, DOMNode} from "../lib/utils.ts";
import {css, setClass} from "../lib/styles.ts";

const inputStyles = {
  error: css("border-color: red; background-color: rgba(255, 0, 0, 0.1);"),
  success: css("border-color: green; background-color: rgba(0, 255, 0, 0.1);"),
};

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error",
  value?: string,
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
    style: props.style,
    value: props.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => props.on?.update((e.target as HTMLInputElement).value),
    onkeydown: props.on?.keydown,
    onblur: props.on?.blur,
    disabled: props.disabled,
  });

  el.addEventListener("focus", () => {
    setClass(el, props.status === "error", inputStyles.error);
    setClass(el, props.status === "success", inputStyles.success);
  });

  if (props.autofocus ?? false) {
    queueMicrotask(() => el.focus());
  }

  return el;
}

export function NInputGroup(props: {style: Partial<CSSStyleDeclaration>}, ...children: DOMNode[]) {
  return m("div", props, children);
}
