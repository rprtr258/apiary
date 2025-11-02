import {m, DOMNode} from "../utils";

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
    oninput: (e: any) => props.on?.update(e.target.value),
  });
}

export function NInputGroup(props: Record<string, any>, ...children: DOMNode[]) {
  return m("div", props, children);
}

type NDropdownProps = {
  trigger: "hover" | "click",
  options: {
    label: string,
    key: string,
    show?: boolean,
    icon?: HTMLElement,
    props?: any,
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
    m("div", {style: {display: open ? null : "none"}}, props.options.map(opt =>
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
  style?: any,
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
    disabled: props.placeholder === undefined ? "" : undefined,
    hidden: "",
    selected: current === null ? "" : undefined,
  }, props.placeholder ?? "");
  const el_opts = props.options.map(({label, value}, i) => m("option", {
    value: i,
    selected: i == current ? "" : undefined,
    disabled: value === undefined ? "" : undefined,
  }, label));

  return {
    el: m("select", {
      style: props.style,
      onchange: (e: InputEvent) => {
        const i = parseInt((e.target! as HTMLSelectElement).value);
        const value = props.options[i].value;
        if (current) {
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
  style?: any,
  on: {click: () => void},
};
export function NButton(props: NButtonProps, ...children: DOMNode[]) {
  return m("button", {
    class: props.class,
    style: props.style,
    onclick: props.on.click,
  }, children);
};