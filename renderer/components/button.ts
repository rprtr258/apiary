import {m, DOMNode, setDisplay} from "../lib/utils.ts";
import {css, setClass} from "../lib/styles.ts";

const btnStyles = {
  primary: css(`
    background-color: #0b74e0;
    color: white;
    border: 1px solid #0b74e0;
  `),
  loading: css(`
    opacity: 0.8;
    cursor: wait;
  `),
  disabled: css(`
    opacity: 0.6;
    cursor: not-allowed;
  `),
};

export default function(props: {
  primary?: boolean,
  disabled?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  on: {click: () => void | Promise<void>},
}, ...children: DOMNode[]) {
  let disabled = props.disabled ?? false;
  let loading = false;

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      textWrapMode: "nowrap",
      ...props.style,
    },
    class: props.class,
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
    setClass(el, !loading && !disabled && (props.primary ?? false), btnStyles.primary);

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
