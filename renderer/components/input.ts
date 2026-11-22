import {m, DOMNode} from "../lib/utils.ts";
import {css, setClass} from "../lib/styles.ts";

// Shared base for every text-entry control (NInput, NSelect, NSelectInput) —
// recessed bg2 field, hairline border, accent focus, no glow. Status classes
// below re-declare border-color on :focus so they win over the base focus rule
// (equal specificity, later in the stylesheet).
export const inputBase = css(`
  font: inherit;
  color: var(--ink);
  background: var(--bg2);
  border: 1px solid var(--hair);
  padding: 4px 8px;
  outline: none;
`, {
  "::placeholder": "color: var(--faint);",
  ":focus": "border-color: var(--accent);",
  ":disabled": "opacity: 0.4; cursor: not-allowed;",
});

const inputStyles = {
  error: css("border-color: var(--err); background-color: color-mix(in srgb, var(--err) 10%, transparent);", {":focus": "border-color: var(--err);"}),
  success: css("border-color: var(--green); background-color: color-mix(in srgb, var(--green) 10%, transparent);", {":focus": "border-color: var(--green);"}),
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
// Status styling is applied continuously; callers with reactive status re-apply
// it through this helper on every state change.
export function setInputStatus(el: HTMLInputElement, status: "success" | "error" | undefined): void {
  setClass(el, status === "error", inputStyles.error);
  setClass(el, status === "success", inputStyles.success);
}
export function NInput(props: NInputProps) {
  const el = m("input", {
    class: inputBase,
    style: props.style,
    value: props.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => props.on?.update((e.target as HTMLInputElement).value),
    onkeydown: props.on?.keydown,
    onblur: props.on?.blur,
    disabled: props.disabled,
  });

  setInputStatus(el, props.status);

  if (props.autofocus ?? false) {
    queueMicrotask(() => el.focus());
  }

  return el;
}

export function NInputGroup(props: {style: Partial<CSSStyleDeclaration>}, ...children: DOMNode[]) {
  return m("div", props, children);
}
