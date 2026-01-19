import {m, DOMNode, setDisplay} from "../utils.ts";
import {css} from "../styles.ts";
import {EInput, ESelect} from "./design-system.ts";

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error", // TODO: highlight with red, method to update
  value?: string,
  on?: {
    update: (value: string) => void,
  },
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  autofocus?: boolean,
};
export function NInput(props: NInputProps) {
  const el = EInput({
    value: props.value ?? "",
    placeholder: props.placeholder,
    disabled: props.disabled,
    style: props.style,
    on: props.on !== undefined ? {update: props.on.update} : undefined,
  });

  if (props.autofocus === true) {
    queueMicrotask(() => el.focus());
  }

  return el;
}

export function NInputGroup(props: {style: Partial<CSSStyleDeclaration>}, ...children: DOMNode[]) {
  return m("div", props, children);
}

type SelectOption<T> = {
  label: string,
  value?: T,
};
type NSelectProps<T> = {
  label?: string,
  options: SelectOption<T>[],
  placeholder?: string,
  style?: Partial<CSSStyleDeclaration>,
  disabled?: boolean,
  on: {update: (value: T) => void},
};
export function NSelect<T>(props: NSelectProps<T>): {el: HTMLElement, reset: () => void} {
  return ESelect({
    label: props.label,
    options: props.options.map(opt => ({
      label: opt.label,
      value: opt.value,
      disabled: opt.value === undefined,
    })),
    placeholder: props.placeholder,
    disabled: props.disabled,
    style: props.style,
    on: props.on,
    size: "md",
  });
}

type NButtonProps = {
  primary?: boolean,
  disabled?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  on: {click: () => void | Promise<void>},
};

const btnStyles = {
  primary: css(`
    background-color: #1890ff;
    color: white;
    border: 1px solid #1890ff;
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

export function NButton(props: NButtonProps, ...children: DOMNode[]) {
  let state: "active" | "disabled" | "loading";

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      textWrapMode: "nowrap",
      ...props.style,
    },
    onclick: async (): Promise<void> => {
      if (state !== "active") {
        return;
      }

      update("loading");
      try {
        await props.on.click();
      } finally {
        update("active");
      }
  }}, el_clock, children);
  function update(newState: typeof state) {
    state = newState;

    el.classList.remove(...el.classList);
    switch (state) {
      case "active": el.classList.toggle(btnStyles.primary, props.primary === true); break;
      case "disabled": el.classList.add(btnStyles.disabled); break;
      case "loading": el.classList.add(btnStyles.loading); break;
    }
    if (props.class !== undefined)
      el.classList.add(props.class);

    setDisplay(el_clock, state === "loading");
    el.disabled = state !== "active";
  }
  update(props.disabled === true ? "disabled" : "active"); // initial update
  return {
    el,
    set loading(value: boolean) {
      update(value ? "loading" : state === "loading" ? "active" : state);
    },
    set disabled(value: boolean) {
      update(value ? "disabled" : state === "disabled" ? "active" : state);
    },
  };
  // return EButton({
  //   variant: props.type === "primary" ? "primary" : "secondary",
  //   disabled: props.disabled,
  //   class: props.class,
  //   style: props.style,
  //   on: props.on,
  // }, ...children);
}
