import {css} from "../styles.ts";
import {clone, m, DOMNode} from "../utils.ts";
import {ResultInfo, FolderOpenOutlined, FolderOutlined} from "./icons.ts";

export function Json<T>(props: {data: T}) {
  return m("pre", JSON.stringify(props.data, null, 2));
};

export type TagType = "success" | "info" | "warning" | "error";
type NTagProps = {
  type: TagType, // TODO: replace with color, use?
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
        warning: "yellow",
        error: "red",
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
    width: props.size !== undefined ? `${props.size}px` : "1em",
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

export const treeLabelClass = css(`
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: clip;
`);
const treeButtonClass = css(`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  font-size: inherit;
  padding-top: 1px;
  padding-bottom: 1px;
`);
const treeButtonHoverClass = css.raw(`:hover {
  background-color: #404040 !important;
}`);

export type TreeOption = {
  key: string,
  label: string,
  disabled?: boolean,
  children?: TreeOption[],
};
type NTreeProps = {
  data: TreeOption[],
  defaultExpandedKeys: string[],
  on: {
    "update:expanded-keys": (keys: string[]) => void,
    drop: (_: {
      node: TreeOption,
      dragNode: TreeOption,
      dropPosition: "before" | "inside" | "after",
    }) => void,
    click: (v: TreeOption) => void,
    context_menu?: (option: TreeOption, event: MouseEvent) => void,
  },
  render: (option: TreeOption, level: number, expanded: boolean) => DOMNode,
};
export function NTree(props: NTreeProps) {
  function renderElem(v: TreeOption, level: number): HTMLElement[] {
    const isExpanded = props.defaultExpandedKeys.includes(v.key);
    const isDir = v.children !== undefined;

    const button = m("span", {
      class: `${treeButtonHoverClass} ${treeButtonClass}`,
      style: {
        paddingLeft: `${level * 1.5}em`,
        boxSizing: "border-box",
      },
      tabIndex: 0,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (e.target as HTMLElement).click();
        }
      },
      onclick: (e: Event) => {
        e.stopPropagation();
        if (isDir) {
          const newKeys = isExpanded
            ? props.defaultExpandedKeys.filter(k => k !== v.key)
            : [...props.defaultExpandedKeys, v.key];
          props.on["update:expanded-keys"](newKeys);
        } else {
          props.on.click(v);
        }
      },
      oncontextmenu: props.on.context_menu !== undefined ? (e: MouseEvent) => {
        e.preventDefault();
        props.on.context_menu!(v, e);
      } : undefined,
    },
      isDir ? NIcon({
        component: isExpanded ? FolderOpenOutlined : FolderOutlined,
        size: 20,
      }) : null,
      props.render(v, level, isExpanded),
    );
    // Set data attributes after creating the element
    button.setAttribute("data-key", v.key);
    button.setAttribute("data-level", level.toString());
    
    const children = isDir && isExpanded ? v.children!.flatMap(w => renderElem(w, level + 1)) : [];
    return [button, ...children];
  }
  return m("div", {}, props.data.flatMap(v => renderElem(v, 0)));
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
