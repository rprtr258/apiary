import {m, DOMNode, setDisplay} from "../lib/utils.ts";
import {css, Size, setClass, sizes} from "../lib/styles.ts";

const buttonSizeStyles: Map<Size, Partial<CSSStyleDeclaration>> = new Map(sizes.map(size => [size, {
  "--button-height": `var(--button-height-${size})`,
  "--button-padding-x": `var(--button-padding-x-${size})`,
  "--button-fz": `var(--font-size-${size})`,
}]));
// The size prop resolves into inline --button-height/
// --button-padding-x/--button-fz variables.
function buttonSizeStyle(size: Size | undefined): Partial<CSSStyleDeclaration> {
  if (size === undefined) {
    return {};
  }
  return buttonSizeStyles.get(size)!;
}

const btnStyles = {
  base: [
    css({
      backgroundColor: "var(--color-default)",
      color: "var(--color-default-color)",
      border: "1px solid var(--color-default-border)",
      borderRadius: "var(--radius-default)",
      height: "var(--button-height)",
      paddingInline: "var(--button-padding-x)",
      fontSize: "var(--button-fz, var(--font-size-2))",
      fontWeight: "600",
      lineHeight: "1",
      userSelect: "none",
      cursor: "pointer",
    }),
    css.raw(":not(:disabled):hover{background-color: var(--color-default-hover);}"),
  ].join(" "),
  primary: [
    css({
      backgroundColor: "var(--color-blue-filled)",
      color: "var(--color-white)",
      border: "1px solid var(--color-blue-filled)",
    }),
    css.raw(":not(:disabled):hover{background-color: var(--color-blue-filled-hover); border-color: var(--color-blue-filled-hover);}"),
  ],
  loading: css({
    opacity: "0.8",
    cursor: "wait",
  }),
  disabled: css({
    opacity: "0.6",
    cursor: "not-allowed",
  }),
};

export default function(props: {
  primary?: boolean,
  disabled?: boolean,
  class?: string,
  size?: Size,
  style?: Partial<CSSStyleDeclaration>,
  on: {click: () => void | Promise<void>},
}, ...children: DOMNode[]) {
  let disabled = props.disabled ?? false;
  let loading = false;

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      ...buttonSizeStyle(props.size),
      textWrapMode: "nowrap",
      ...props.style,
    },
    class: props.class === undefined ? btnStyles.base : `${btnStyles.base} ${props.class}`,
    onclick: async (): Promise<void> => {
      if (disabled || loading) {
        return;
      }

      loading = true;
      update();
      try {
        await props.on.click();
      } finally {
        loading = false;
        update();
      }
  }}, el_clock, children);
  function update() {
    setClass(el, loading, btnStyles.loading);
    setClass(el, !loading && disabled, btnStyles.disabled);
    setClass(el, !loading && !disabled && (props.primary ?? false), ...btnStyles.primary);
    setDisplay(el_clock, loading);
    el.disabled = disabled || loading;
  }
  update(); // initial update
  return {
    el,
    set loading(value: boolean) {
      loading = value;
      update();
    },
    set disabled(value: boolean) {
      disabled = value;
      update();
    },
  };
}
