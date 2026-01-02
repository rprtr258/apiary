import {m, DOMNode} from "../utils.ts";

type NInputProps = {
  placeholder?: string,
  status?: "success" | "error", // TODO: highlight with red, method to update
  value?: string,
  on?: {
    update: (value: string) => void,
  },
};
export function NInput(props: NInputProps) {
  return m("input", {
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
  let open = false;
  return m("span", {
    onclick:     () => {if (props.trigger !== "click") return; open = !open;},
    onmouseover: () => {if (props.trigger !== "hover") return; open = !open;},
  }, [
    ...children,
    m("div", {style: {display: open ? "block" : "none"}}, props.options.map(opt =>
      m("div", {
        onclick: () => {open = false; props.on.select(opt.key);},
      }, [
        ...(opt.icon ? [opt.icon] : []),
        opt.label,
      ]))),
  ]);
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
  let current: number | null = props.options.findIndex(opt => opt.label == props.label);
  if (current == -1) {
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
    selected: i == current,
    disabled: value === undefined,
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
      if (current === null) {return;}

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