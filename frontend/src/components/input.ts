import {m, DOMNode, Signal, setDisplay} from "../utils.ts";
import {css} from "../styles.ts";
import {useButton} from "../hooks/form/useButton.ts";

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
  type?: "primary",
  disabled?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  on: {click: () => void | Promise<void>},
};

const btnPrimaryStyle = css(`
  background-color: #1890ff;
  color: white;
  border: 1px solid #1890ff;
`);
const btnLoadingStyle = css(`
  opacity: 0.8;
  cursor: wait;
`);
const btnDisabledStyle = css(`
  opacity: 0.6;
  cursor: not-allowed;
`);

export function NButton(props: NButtonProps, ...children: DOMNode[]) {
  const buttonHook = useButton({
    on: props.on,
    disabled: props.disabled,
  });

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      textWrapMode: "nowrap",
      ...props.style,
    },
    onclick: () => buttonHook.on.click(),
  }, el_clock, children);
  const update = () => {
    if (props.class !== undefined)
      el.classList.add(props.class);
    el.classList.toggle(btnPrimaryStyle, props.type === "primary");
    el.classList.toggle(btnDisabledStyle, buttonHook.disabledSignal.value);
    el.classList.toggle(btnLoadingStyle, buttonHook.loadingSignal.value);

    setDisplay(el_clock, buttonHook.loadingSignal.value);
    el.disabled = buttonHook.disabledSignal.value || buttonHook.loadingSignal.value ? true : false;
  };
  buttonHook.disabledSignal.sub(function*() {
    while (true) {
      yield;
      update();
    }
  }());
  buttonHook.loadingSignal.sub(function*() {
    while (true) {
      yield;
      update();
    }
  }());
  return {
    el,
    set loading(loading: boolean) {
      buttonHook.loading = loading;
    },
    set disabled(disabled: boolean) {
      buttonHook.disabled = disabled;
    },
  };
}
