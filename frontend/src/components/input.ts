import m, {Vnode} from "mithril";
import {Button} from "bootstrap";

type NInputProps = {
  value: string,
  on: {update: (value: string) => void},
};
export const NInput = {
  view(vnode: Vnode<any, any>) {
    const props = vnode.attrs as NInputProps;
    return m("input", {
      value: props.value,
      oninput: (e: any) => props.on.update(e.target.value),
    });
  }
}

export const NInputGroup = {
  view(vnode: Vnode<any, any>) {
    const props = vnode.attrs;
    return m("div", props, vnode.children);
  }
}

type NDropdownProps = {
  trigger: "hover" | "click",
  options: {
    label: string,
    key: string,
    show?: boolean,
    icon?: () => any,
    props?: any,
  }[],
  on: {select: (key: string | number) => void},
};
export function NDropdown() {
  let open = false;
  return {
    view(vnode: Vnode<NDropdownProps, any>) {
      const props = vnode.attrs;
      return m("span", {
        onclick:     () => {if (props.trigger !== "click") return; open = !open;},
        onmouseover: () => {if (props.trigger !== "hover") return; open = !open;},
      }, [
        vnode.children,
        m("div", {style: {display: open ? null : "none"}}, props.options.map(opt =>
          m("div", {
            onclick: () => {open = false; props.on.select(opt.key);},
          }, [
            (opt.icon ?? (() => null))(),
            opt.label,
          ]))),
      ]);
    },
  };
};

// TODO: make generic over value type
type SelectOption = {
  label: string,
  value: string,
};
type NSelectProps = {
  value: string,
  options: (SelectOption | {
    type: "group",
    label: string, // TODO: generic
    key: string,
    children: SelectOption[],
  })[],
  placeholder?: string,
  clearable?: true,
  style?: any,
  loading?: boolean,
  remote?: true,
  on: {update: (value: string) => void},
};
export function NSelect() {
  let open = false;
  let current : number | null = null;
  return {
    view(vnode: Vnode<NSelectProps, any>) {
      const props = vnode.attrs;
      // TODO: use groups
      const options = props.options.filter(v => !("type" in v)).map(v => v as SelectOption);

      const idx = options.findIndex(v => v.value == props.value);
      if (idx != -1) {
        current = idx;
      }

      return m("select", {
        style: props.style,
        onchange: (e: InputEvent) => {
          const i = parseInt((e.target! as HTMLSelectElement).value);
          const value = options[i].value;
          current = i;
          props.on.update(value);
        },
      }, [m("option", {
        value: "",
        disabled: true,
        selected: current === null,
        hidden: true,
      }, props.placeholder)].concat(props.options.map(({label}, i) =>
        m("option", {
          value: i,
          selected: i == current,
        }, label)
      )));
    }
  };
}

export const NButton = {
  view(vnode: Vnode<{
    type?: "primary",
    disabled?: boolean,
    class?: string,
    style?: any,
    on: {click: () => void},
  }, any>) {
    const props = vnode.attrs;
    return m("button", {
      class: props.class,
      style: props.style,
      onclick: props.on.click,
    }, vnode.children);
  },
};