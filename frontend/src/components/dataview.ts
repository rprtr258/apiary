import {clone, m, DOMNode} from "../utils.ts";
import {ResultInfo} from "./icons.ts";

export function Json<T>(props: {data: T}) {
  return m("pre", JSON.stringify(props.data, null, 2));
};

type NTagProps = {
  type: "success" | "info" | "warning", // TODO: replace with color, use?
  style?: Partial<CSSStyleDeclaration>,
  size: "small",
  round?: true,
};
export function NTag(props: NTagProps, label: string) {
  return m("span", {
    style: {
      color: {
        success: "lime",
        info: "blue",
        warning: "red",
      }[props.type],
      ...props.style,
    },
  }, label);
};

type NIconProps = {
  size?: number,
  color?: string,
  class?: string,
  component: string | SVGSVGElement,
};
export function NIcon(props: NIconProps) {
  return m("div", {class: props.class, style: {
    width: "1em",
    display: "inline-block",
    color: props.color,
  }}, [clone(props.component)]);
};

type NResultProps = {
  status: "info" | "success" | "warning" | "error" | "404" | "403" | "500" | "418",
  title: string,
  description: string,
};
export function NResult(props: NResultProps) {
  const el_status = props.status === "info" ? ResultInfo : m("i", {}, props.status);
  return m("div", {
    class: "h100",
    style: {
      justifyContent: "center",
      display: "flex",
      alignItems: "center",
      flexDirection: "column",
    },
  },
    m("h1", {}, el_status, props.title),
    props.description,
  );
}

type NEmptyProps = {
  description: string,
  class?: string[],
  style?: Partial<CSSStyleDeclaration>,
};
export function NEmpty(props: NEmptyProps) {
  return m("div", {
    class: ["h100", ...(props.class ?? [])].join(" "),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...props.style,
    },
  }, [props.description]);
};

export function NList(...children: DOMNode[]) {
  return m("ul", {}, children);
};

type NListItemProps = {
  class: string,
};
export function NListItem(props: NListItemProps, children: DOMNode[]) {
  return m("li", {class: props.class}, children);
};

export type TreeOption = {
  key: string,
  label: string,
  children?: TreeOption[],
  disabled?: boolean,
};
type NTreeProps = {
  "selected-keys": string[],
  data: TreeOption[],
  "default-expanded-keys": string[],
  on: {
    "update:expanded-keys": (keys: string[]) => void,
    drop: (_: {
      node: TreeOption,
      dragNode: TreeOption,
      dropPosition: "before" | "inside" | "after",
    }) => void,
  },
  render: (option: TreeOption, checked: boolean, selected: boolean) => DOMNode,
};
export function NTree(props: NTreeProps) {
  const renderElem = (v: TreeOption, level: number): HTMLDivElement =>
    m("div", {style: {marginLeft: `${level == 0 ? 0 : 1}em`}}, [
      v.children !== undefined ?
      m("details", {open: true}, [
        m("summary", {}, [v.label]),
        ...v.children.map(w => renderElem(w, level+1)),
      ]) :
      m("span", {}, props.render(v, false, false)),
    ]);
  return m("div", {}, props.data.map(v => renderElem(v, 0)));
};

export function NTable(props: Record<string, unknown>, children: DOMNode[]) {
  return m("table", props, children);
};

export function NTooltip(
  props: Record<string, unknown> & {show?: boolean, style?: Record<string, unknown>},
  ...children: DOMNode[]
) : DOMNode {
  return m("div", {
    ...props,
    style: {
      display: props.show === true ? "block" : "none",
      ...props.style,
    },
  }, children);
};
