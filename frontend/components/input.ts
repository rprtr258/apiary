import {m, DOMNode, setDisplay} from "../utils.ts";
import {css} from "../styles.ts";

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
  const el = m("input", {
    style: props.style,
    value: props.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => props.on?.update((e.target as HTMLInputElement).value),
    disabled: props.disabled,
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
  let current: number | null = props.options.findIndex(opt => opt.label === props.label);
  if (current === -1) {
    if (props.placeholder === undefined) {
      throw new Error(`Option ${props.label} not found in ${JSON.stringify(props.options)}`);
    }
    current = null;
  }

  const el_placeholder = m("option", {
    value: "",
    disabled: props.placeholder === undefined ? true : undefined,
    hidden: true,
    selected: current === null ? true : undefined,
  }, props.placeholder ?? "");
  const el_opts = props.options.map(({label, value}, i) => m("option", {
    value: String(i),
    selected: i === current ? true : undefined, // NOTE: any value makes selected, so we explicitly set undefined
    disabled: value === undefined ? true : undefined,
  }, label));

  const el = m("select", {
    style: props.style,
    onchange: (e: Event) => {
      const i = parseInt((e.target! as HTMLSelectElement).value);
      const value = props.options[i].value;
      if (current !== null) {
        el_opts[current].selected = false;
      }
      el_opts[i].selected = true;
      current = i;
      props.on.update(value!);
    },
  },
    el_placeholder,
    ...el_opts,
  );

  // Workaround for happy-dom bug: set selectedIndex after creating select
  if (current !== null) {
    el.selectedIndex = current + 1; // +1 for placeholder
  }

  return {
    el,
    reset() {
      if (current === null)
        return;

      el_opts[current].selected = false;
      el_placeholder.selected = true;
      current = null;
      el.selectedIndex = 0; // Select placeholder
    },
  };
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
}
