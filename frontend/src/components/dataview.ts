import m, {Vnode} from "mithril";

export type VNodeChild = any;

export const Json = {
  view(vnode: Vnode<any, any>) {
    const props = vnode.attrs;
    return m("pre", JSON.stringify(props.data, null, 2));
  },
};

type NTagProps = {
  type: "success" | "info" | "warning", // TODO: replace with color, use?
  style?: any,
  size: "small",
  round?: true,
};
export const NTag = {
  view(vnode: Vnode<NTagProps, any>) {
    const props = vnode.attrs as NTagProps;
    return m("span", {
      style: {
        color: {
          success: "lime",
          info: "blue",
          warning: "red",
        }[props.type],
        ...props.style,
      },
    }, vnode.children);
  }
};

type NIconProps = {
  size?: number,
  color?: string,
  component: Vnode<any, any> | string,
};
export const NIcon = ({
  view(vnode: Vnode<NIconProps, any>) {
    const props = vnode.attrs as NIconProps;
    return m("div", {style: {width: "1em", display: "inline-block"}}, props.component);
  }
});

export const NResult = {
  view(vnode: Vnode<{
    status: string,
    title: string,
    description: string,
    class: string,
    style?: any,
  }, any>) {
    const props = vnode.attrs;
    return m("div", {
      class: props.class,
      style: props.style,
    }, [
      m("h1", [m("i", props.status), props.title]),
      props.description,
    ]);
  }
}

export const NEmpty = {
  view(vnode: Vnode<{
    description: string,
    class: string,
    style: any,
  }, any>) {
    const props = vnode.attrs;
    return m("div", {
      class: props.class,
      style: props.style,
    }, props.description);
  },
};

export const NList = {
  view(vnode: Vnode<{
    hoverable: true,
    border: false,
  }, any>) {
    return m("ul", vnode.children);
  },
};
export const NListItem = {
  view(vnode: Vnode<{
    class: string,
  }, any>) {
    const props = vnode.attrs;
    return m("li", {
      class: props.class,
    }, vnode.children);
  },
};


export type TreeOption = {
  key: string,
  label: string,
  children?: TreeOption[],
  disabled?: boolean,
};

type NTreeProps = {
  "block-line": true,
  "expand-on-click": true,
  "selected-keys": string[],
  "show-line": true,
  data: TreeOption[],
  draggable: true,
  "default-expanded-keys": string[],
  on: {
    "update:expanded-keys": (keys: string[]) => void,
    drop: (_: {
      node: TreeOption,
      dragNode: TreeOption,
      dropPosition: "before" | "inside" | "after",
    }) => void,
  },
  "node-props": (x: {option: TreeOption}) => {onclick: () => void},
  "render-prefix": (info: {option: TreeOption, checked: boolean, selected: boolean}) => VNodeChild,
  "render-suffix": (info: {option: TreeOption}) => VNodeChild,
};
export const NTree = {
  view(vnode: Vnode<any, any>) {
    const props = vnode.attrs as NTreeProps;
    const renderElem = (v: TreeOption, level: number): any =>
      m("div", {style: {"margin-left": `${level == 0 ? 0 : 1}em`}}, [
        v.children ?
        m("details", {open: true}, [
          m("summary", v.label),
          v.children.map(w => renderElem(w, level+1)),
        ]) :
        m("span", [
          props["render-prefix"]({option: v, checked: false, selected: false}),
          m("button", props["node-props"]({option: v}), v.label),
          props["render-suffix"]({option: v}),
        ]),
      ]);
    return m("div", props.data.map(v => renderElem(v, 0)));
  },
};

export const NTable = {
  view(vnode: Vnode<any, any>) {
    const props = vnode.attrs;
    return m("table", props, vnode.children);
  },
};

export const NTooltip = {
  view(vnode: Vnode<any, any>) {
    const props = vnode.attrs;
    if (!props.show) return null

    return m("div", vnode.attrs, vnode.children);
  },
};
