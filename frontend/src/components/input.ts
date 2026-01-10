import {m, DOMNode, Signal, setDisplay} from "../utils.ts";

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error", // TODO: highlight with red, method to update
  value?: string,
  on?: {
    update: (value: string) => void,
  },
  style?: Partial<CSSStyleDeclaration>,
};
export function NInput(props: NInputProps) {
  return m("input", {
    style: props.style,
    value: props.value,
    placeholder: props.placeholder,
    oninput: (e: Event) => props.on?.update((e.target as HTMLInputElement).value),
  });
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
      display: props.open.value ? "block" : "none",
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
  props.open.sub(open => {
    setDisplay(dropdownEl, open);
    if (!open)
      return;

    const rect = span.getBoundingClientRect();
    dropdownEl.style.top = `${rect.bottom}px`;
    dropdownEl.style.left = `${rect.left}px`;
  }, true);
  return span;
};

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
    disabled: props.placeholder === undefined,
    hidden: true,
    selected: current === null,
  }, props.placeholder ?? "");
  const el_opts = props.options.map(({label, value}, i) => m("option", {
    value: String(i),
    selected: i === current ? true : undefined, // NOTE: any value makes selected, so we explicitly set undefined
    disabled: value === undefined ? true : undefined,
  }, label));

  return {
    el: m("select", {
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
    ),
    reset() {
      if (current === null)
        return;

      el_opts[current].selected = false;
      el_placeholder.selected = true;
      current = null;
    },
  };
}

type NButtonProps = {
  type?: "primary",
  disabled?: boolean,
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  on: {click: () => void},
};
export function NButton(props: NButtonProps, ...children: DOMNode[]) {
  return m("button", {
    class: props.class,
    style: props.style,
    onclick: props.on.click,
  }, children);
};