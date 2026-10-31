import {css} from "../lib/styles.ts";
import {clone, m, DOMNode} from "../lib/utils.ts";
import {ItemBadge} from "../plugins/types.ts";
import {ResultInfo, FolderOpenOutlined, FolderOutlined} from "./icons.ts";

export function Json<T>(data: T) {
  return m("pre", {}, JSON.stringify(data, null, 2));
};

export type TagType = "success" | "info" | "warning" | "error";
export const tagColors: Record<TagType, string> = {
  success: "var(--color-lime-4)",
  info: "var(--color-blue-4)",
  warning: "var(--color-yellow-4)",
  error: "var(--color-red-4)",
};
export type NTagProps = {
  label: string,
  tooltip?: string,
  color?: string,
  background?: string,
  bordered?: boolean,
  class?: string,
  style?: Partial<Omit<CSSStyleDeclaration, "color" | "backgroundColor">>,
};
export function NTag(props: NTagProps) {
  return m("span", {
    class: props.class,
    style: {
      color: props.color,
      backgroundColor: props.background,
      ...((props.bordered ?? false) ? {
        borderColor: props.color,
        borderWidth: "1px",
        borderStyle: "solid",
        borderRadius: "2px",
      } : {}),
      ...props.style,
    },
    title: props.tooltip,
  }, props.label);
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

type NEmptyProps = {
  status?: "info" | "success" | "warning" | "error" | "404" | "403" | "418" | "500",
  title?: string,
  description: string,
};
export function NEmpty(props: NEmptyProps) {
  const el_heading = props.title === undefined ? null : m("h1", {},
    props.status === undefined || props.status === "info" ? ResultInfo : m("i", {}, props.status),
    props.title,
  );
  return m("div", {
    class: "h100",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
    },
  }, el_heading, props.description);
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
`);
const treeButtonHoverClass = css.raw(`:hover {
  background-color: var(--color-dark-5) !important;
}`);

export type TreeOption = {
  key: string,
  label: string,
  disabled?: boolean,
  tag?: ItemBadge, // baked at materialization; rendered by the sidebar tree
  loading?: boolean, // baked at materialization; drives the request-row pulse
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
      class: `${treeButtonClass}`,
      style: {
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
      m("div", {style: {minWidth: `${level * 1.5}em`}}, " "),
      m("span", {class: treeButtonHoverClass, style: {display: "flex", width: "100%", height: "100%"}},
        isDir ? NIcon({
          component: isExpanded ? FolderOpenOutlined : FolderOutlined,
          size: 20,
        }) : null,
        props.render(v, level, isExpanded),
      ),
    );
    const children = isDir && isExpanded ? v.children!.flatMap(w => renderElem(w, level + 1)) : [];
    return [button, ...children];
  }
  return m("div", {}, props.data.flatMap(v => renderElem(v, 0)));
};

export function StatusLabel() {
  const el = m("div", {style: {fontSize: ".8em", whiteSpace: "pre-wrap"}});
  return {
    el,
    setStatus(message: string, isSuccess: boolean) {
      el.textContent = message;
      el.style.color = isSuccess ? "green" : "red";
    },
  };
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
      display: props.show ?? false ? "block" : "none",
      ...props.style,
    },
  }, children);
};
