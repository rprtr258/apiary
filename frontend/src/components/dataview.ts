import {css} from "../styles.ts";
import {clone, m, DOMNode, ElementProps} from "../utils.ts";
import {ResultInfo, FolderOpenOutlined, FolderOutlined} from "./icons.ts";
import {EmptyState, Card, Badge} from "./design-system.ts";

export function Json<T>(props: {data: T}) {
  return m("pre", {}, JSON.stringify(props.data, null, 2));
};

export type TagType = "success" | "info" | "warning" | "error";
type NTagProps = {
  type: TagType, // TODO: replace with color, use?
  style?: Partial<CSSStyleDeclaration>,
  round?: boolean,
};
export function NTag(props: NTagProps, label: string) {
  const variantMap: Record<TagType, "success" | "info" | "warning" | "error"> = {
    success: "success",
    info: "info",
    warning: "warning",
    error: "error",
  };

  return Badge({
    children: [label],
    variant: variantMap[props.type],
    size: "sm",
    rounded: props.round === true,
    style: props.style,
  });
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

  return Card({
    children: [
      m("div", {style: {marginBottom: "var(--spacing-lg)"}}, el_status),
      m("h3", {
        style: {
          fontSize: "var(--font-size-xl)",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--color-text-primary)",
          margin: "0 0 var(--spacing-sm) 0",
        },
      }, props.title),
      m("p", {
        style: {
          fontSize: "var(--font-size-md)",
          color: "var(--color-text-secondary)",
          margin: "0",
          maxWidth: "400px",
        },
      }, props.description),
    ],
    variant: "outlined",
    padding: "xl",
    class: "h100",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    },
  });
}

type NEmptyProps = {
  description: string,
  class?: string[],
  style?: Partial<CSSStyleDeclaration>,
};
export function NEmpty(props: NEmptyProps) {
  return EmptyState({
    title: "No Data",
    description: props.description,
    class: ["h100", ...(props.class ?? [])].join(" "),
    style: props.style,
  });
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
    const children = isDir && isExpanded ? v.children!.flatMap(w => renderElem(w, level + 1)) : [];
    return [button, ...children];
  }
  return m("div", {}, props.data.flatMap(v => renderElem(v, 0)));
};

export function NTable(props: ElementProps<"table">, children: DOMNode[]) {
  return m("table", props, children);
};

export function NTooltip(
  props: ElementProps<"div"> & {show?: boolean},
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
