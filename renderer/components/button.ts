import {m, DOMNode, setDisplay} from "../lib/utils.ts";
import {css, setClass} from "../lib/styles.ts";

const btnStyles = {
  // Base look for every NButton (ef "tb-btn"): quiet hairline box, sel hover.
  base: css(`
    font: inherit;
    color: var(--ink);
    background: transparent;
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
  `, {
    ":hover": "background: var(--sel);",
    ":disabled": "opacity: 0.4; cursor: not-allowed;",
    ":disabled:hover": "background: transparent;",
  }),
  primary: css(`
    background-color: var(--accent);
    color: var(--accent-ink);
    border: 1px solid var(--accent);
  `, {
    ":hover": "background-color: var(--accent);",
  }),
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
    class: props.class !== undefined ? [btnStyles.base, props.class] : btnStyles.base,
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
