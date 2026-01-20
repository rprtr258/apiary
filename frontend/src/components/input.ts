import {css} from "../styles.ts";
import {m, DOMNode, Signal, setDisplay, arrayGet} from "../utils.ts";
import {useInput} from "../hooks/form/useInput.ts";
import {SelectOption, useSelect} from "../hooks/form/useSelect.ts";
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
};

export function NInput(props: NInputProps) {
  const inputHook = useInput({
    initialValue: props.value,
    on: {
      change: props.on?.update,
    },
  });

  const getStatusStyle = () => {
    if (!inputHook.touched)
      return {};

    return {
      borderColor: props.status === "error" ? "red" :
                   props.status === "success" ? "green" :
                   undefined,
      backgroundColor: props.status === "error" ? "rgba(255, 0, 0, 0.1)" :
                   props.status === "success" ? "rgba(0, 255, 0, 0.1)" :
                   undefined,
    };
  };

  const el = m("input", {
    value: inputHook.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => inputHook.on.change((e.target as HTMLInputElement).value),
    onblur: () => inputHook.on.blur(),
    onfocus: () => inputHook.on.focus(),
    disabled: props.disabled,
  });
  inputHook.valueSignal.sub(function*() {
    while (true) {
      yield;
      Object.assign(el.style, {
        ...props.style,
        ...getStatusStyle(),
      });
    }
  }());
  return el;
}

export function NInputGroup(props: {style: Partial<CSSStyleDeclaration>}, ...children: DOMNode[]) {
  return m("div", props, children);
}

type NDropdownProps = {
  trigger: "hover" | "click",
  open: Signal<boolean>,
  options: {
    label: string,
    key: string,
    show?: boolean,
    icon?: HTMLElement,
    on?: {
      click?: () => void,
    },
  }[],
  on: {select: (key: string) => void},
};
export function NDropdown(props: NDropdownProps, children: HTMLElement[]) {
  // TODO: append to document body?
  const dropdownEl = m("div", {
    style: {
      position: "fixed",
      zIndex: "1000",
      background: "#2a2a2a",
      color: "#ffffff",
      border: "1px solid #404040",
      borderRadius: "4px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      minWidth: "120px",
    },
  }, props.options.map(opt =>
    m("div", {
      style: {
        padding: "8px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "#ffffff",
        ...(opt.show === false ? {display: "none"} : {}),
      },
      onclick: () => {props.open.update(() => false); opt.on?.click?.(); props.on.select(opt.key);},
      onmouseover: (e: Event) => {(e.currentTarget as HTMLElement).style.background = "#404040";},
      onmouseout: (e: Event) => {(e.currentTarget as HTMLElement).style.background = "";},
    }, [
      ...(opt.icon !== undefined ? [opt.icon] : []),
      opt.label,
    ])));
  const span = m("span", {
    style: {display: "inline-block"},
    onclick:     _ => {if (props.trigger !== "click") return; props.open.update(_ => true);},
    onmouseover: _ => {if (props.trigger !== "hover") return; props.open.update(_ => true);},
    onmouseout:  e => {if (props.trigger !== "hover" || !span.contains(e.relatedTarget as Node)) return; props.open.update(() => false);},
  }, [
    ...children,
    dropdownEl,
  ]);
  props.open.sub(function*() {
    while (true) {
      const open = yield;
      setDisplay(dropdownEl, open);
      if (!open)
        continue;

      const rect = span.getBoundingClientRect();
      dropdownEl.style.top = `${rect.bottom}px`;
      dropdownEl.style.left = `${rect.left}px`;
    }
  }());
  return span;
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
  // Find initial value based on label
  const initialValue = props.label !== undefined && props.label !== ""
    ? props.options.find(opt => opt.label === props.label)?.value
    : undefined;

  if (props.options.findIndex(opt => opt.value === initialValue) === -1 && props.placeholder === undefined) {
    throw new Error(`Option ${props.label} not found in ${JSON.stringify(props.options)}`);
  }

  const selectHook = useSelect({
    options: props.options,
    initialValue,
    placeholder: props.placeholder,
    on: {
      change: (value) => {
        if (value.isSome()) {
          props.on.update(value.value);
        }
      },
    },
  });

  const el_placeholder = m("option", {
    value: "",
    disabled: props.placeholder === undefined ? true : undefined,
    hidden: true,
    selected: selectHook.value.isNone() ? true : undefined,
  }, props.placeholder ?? "");
  const el_opts = props.options.map(({label, value, disabled}, i) => m("option", {
    value: String(i),
    selected: (selectHook.value.isSome() && selectHook.value.value === value) ? true : undefined, // NOTE: any value makes selected, so we explicitly set undefined
    disabled: disabled === true ? true : undefined,
  }, label));

  const el = m("select", {
    style: props.style,
    disabled: props.disabled === true ? true : undefined,
    onchange: (e: Event) => {
      const i = parseInt((e.target! as HTMLSelectElement).value);
      const value = arrayGet(props.options, i).map(o => o.value);
      selectHook.on.change(value);
    },
  },
    el_placeholder,
    el_opts,
  );
  // Workaround for happy-dom bug: set selectedIndex after creating select
  if (selectHook.value.isSome()) {
    el.selectedIndex = props.options.findIndex(opt => opt.value === selectHook.value.unwrap()) + 1; // +1 for placeholder
  }

  return {
    el,
    reset() {
      selectHook.reset();
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
    disabled: props.disabled === true ? true : undefined,
  });

  const el_clock = m("span", {style: {marginRight: "8px"}}, "⏳");
  const el = m("button", {
    style: {
      textWrapMode: "nowrap",
      ...props.style,
    },
    onclick: () => buttonHook.on.click(),
    disabled: buttonHook.disabledSignal.value || buttonHook.loadingSignal.value ? true : undefined,
  }, el_clock, children);
  const update = () => {
    if (props.class !== undefined)
      el.classList.add(props.class);
    el.classList.toggle(btnPrimaryStyle, props.type === "primary");
    el.classList.toggle(btnDisabledStyle, buttonHook.disabledSignal.value);
    el.classList.toggle(btnLoadingStyle, buttonHook.loadingSignal.value);

    setDisplay(el_clock, buttonHook.loadingSignal.value);
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
