import {css} from "../lib/styles.ts";
import {clone, m, DOMNode} from "../lib/utils.ts";
import {ItemBadge} from "../plugins/types.ts";
import {ResultInfo, FolderOpenOutlined, FolderOutlined} from "./icons.ts";

export function Json<T>(data: T) {
  return m("pre", {}, JSON.stringify(data, null, 2));
};

export type TagType = "success" | "info" | "warning" | "error";
export const tagColors: Record<TagType, string> = {
  success: "var(--green)",
  info: "var(--accent)",
  warning: "var(--warn)",
  error: "var(--err)",
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
  flex: 1;
  min-width: 0;
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: clip;
`);
const noShrinkClass = css("flex: 0 0 auto;");
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
  position: relative;
  /* Rows are hard-capped at the sidebar width: nothing inside (labels, the
     absolute drop marker) may widen the scroll area - labels ellipsize, and
     a deep-indent drop line past a narrow row is clipped away */
  overflow-x: clip;
`);
const treeButtonHoverClass = css.raw(`:hover {
  background-color: var(--sel) !important;
}`);
const treeDropIntoClass = css.raw(` {
  background-color: var(--sel) !important;
  outline: 1px dashed var(--faint);
  outline-offset: -1px;
}`);

export type TreeOption = {
  key: string,
  label: string,
  disabled?: boolean,
  // Virtual items (source listings, placeholders) are neither draggable nor
  // drop targets; real requests and dirs default to draggable
  draggable?: boolean,
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
// Active sidebar drag and current drop indicator, module-level because store
// fetches rebuild all row elements mid-drag (a per-instance stash would be
// lost); only one tree drag can be in progress app-wide. The marker carries
// the hovered row so the container's single drop handler can resolve the
// drop destination without per-row drop handlers.
let treeDrag: TreeOption | undefined = undefined;
let dropMarker: {el: HTMLElement, pos: "before" | "inside" | "after", node: TreeOption, line: HTMLElement | undefined} | undefined = undefined;

function setDropMarker(el: HTMLElement, pos: "before" | "inside" | "after", node: TreeOption, indent: number): void {
  if (dropMarker !== undefined && dropMarker.el === el && dropMarker.pos === pos)
    return;
  clearDropMarker();
  if (pos === "inside") {
    el.classList.add(treeDropIntoClass);
    dropMarker = {el, pos, node, line: undefined};
    return;
  }
  // Insert line at the row's edge, offset to the level the item lands at so
  // the marker shows which directory it drops into (a boundary between rows
  // of different dirs draws two differently-indented lines depending on the
  // hovered half)
  const line = m("div", {style: {
    position: "absolute",
    left: `${indent * 1.5}em`,
    right: "0",
    height: "2px",
    background: "var(--faint)",
    pointerEvents: "none",
    ...(pos === "before" ? {top: "0"} : {bottom: "0"}),
  }});
  el.appendChild(line);
  dropMarker = {el, pos, node, line};
}

function clearDropMarker(): void {
  if (dropMarker === undefined)
    return;
  dropMarker.el.classList.remove(treeDropIntoClass);
  dropMarker.line?.remove();
  dropMarker = undefined;
}

export function NTree(props: NTreeProps) {
  // Flattened render order with each row's previous rendered row and parent
  // option: the dragover handler collapses same-dir boundaries (see below),
  // which needs rendered-order neighbors, not tree-data siblings. Recomputed
  // per render since rows rebuild on every update.
  type FlatRow = {
    option: TreeOption,
    level: number,
    parent: TreeOption | undefined,
    prev: FlatRow | undefined,
    next: FlatRow | undefined,
    el: HTMLElement | undefined,
  };
  const rows: FlatRow[] = [];
  const flatten = (options: TreeOption[], level: number, parent: TreeOption | undefined): void => {
    for (const v of options) {
      const row: FlatRow = {option: v, level, parent, prev: rows.at(-1), next: undefined, el: undefined};
      rows.push(row);
      if (v.children !== undefined && props.defaultExpandedKeys.includes(v.key))
        flatten(v.children, level + 1, v);
    }
  };
  flatten(props.data, 0, undefined);
  for (const [i, row] of rows.entries())
    row.next = rows[i + 1];

  function renderRow(row: FlatRow): HTMLElement {
    const v = row.option;
    const level = row.level;
    const isExpanded = props.defaultExpandedKeys.includes(v.key);
    const isDir = v.children !== undefined;
    const draggable = v.draggable ?? true;

    const button = m("span", {
      class: `${treeButtonClass}`,
      style: {
        boxSizing: "border-box",
      },
      tabIndex: 0,
      draggable,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (e.target as HTMLElement).click();
        }
      },
      ondragstart: (e: DragEvent) => {
        treeDrag = v;
        // Chromium only starts a drag when data is set
        e.dataTransfer?.setData("text/plain", v.key);
        if (e.dataTransfer !== null)
          e.dataTransfer.effectAllowed = "move";
      },
      ondragend: () => {
        treeDrag = undefined;
        clearDropMarker();
      },
      ondragover: (e: DragEvent) => {
        if (treeDrag === undefined)
          return;
        if (!draggable) {
          // Not a drop target: keep the container from treating this as a
          // root-area drop, but allow no drop here either
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const inside = isDir && rect.height / 3 < y && y < 2 * rect.height / 3;
        const pos = inside ? "inside" : y <= rect.height / 2 ? "before" : "after" as const;
        // Adjacent rows of the same dir describe their shared boundary twice
        // ("after prev" / "before this"); collapse to the previous row so
        // each boundary has a single drop position. The lower edge of an
        // expanded dir is likewise a shared boundary (dir / first child):
        // "after the dir" there draws between the dir and its children while
        // moving at the parent level, so resolve it to what the line shows —
        // the dir's first child. A collapsed dir's lower edge borders its
        // next sibling (parent-level position), and virtual children are not
        // drop targets, so both keep the parent-level meaning.
        if (pos === "before" && row.prev !== undefined && row.prev.parent === row.parent) {
          setDropMarker(row.prev.el!, "after", row.prev.option, row.prev.level);
          return;
        }
        if (pos === "after" && row.next !== undefined && row.next.parent === v && (row.next.option.draggable ?? true)) {
          setDropMarker(row.next.el!, "before", row.next.option, row.next.level);
          return;
        }
        // indent = the rendered level the item lands at (one deeper when
        // dropping inside a dir; unused there, the row itself is highlighted)
        setDropMarker(e.currentTarget as HTMLElement, pos, v, inside ? row.level + 1 : row.level);
      },
      ondragleave: (e: DragEvent) => {
        if (dropMarker?.el !== e.currentTarget)
          return;
        // Moving between the row's own children fires leave as well; only
        // leaving the row entirely clears the marker
        if (e.relatedTarget instanceof Node && (e.currentTarget as HTMLElement).contains(e.relatedTarget))
          return;
        clearDropMarker();
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
      m("div", {style: {width: `${level * 1.5}em`, minWidth: "0", flexShrink: "1"}}, " "),
      m("span", {class: treeButtonHoverClass, style: {display: "flex", flex: "1", minWidth: "0", height: "100%"}},
        isDir ? NIcon({
          component: isExpanded ? FolderOpenOutlined : FolderOutlined,
          size: 20,
          class: noShrinkClass,
        }) : null,
        props.render(v, level, isExpanded),
      ),
    );
    row.el = button;
    return button;
  }
  // min-height keeps the empty space below the rows inside the root drop zone
  // (dropping there moves the item to the tree root). The single drop handler:
  // drops on rows bubble here, and the marker (set by row dragover) names the
  // hovered row; with no marker the drop is the root area.
  return m("div", {
    style: {minHeight: "100%"},
    ondragover: (e: DragEvent) => {
      if (treeDrag === undefined)
        return;
      e.preventDefault();
      // Empty space has no row target; also discards a stale marker left by a
      // mid-drag rebuild before its row was replaced
      clearDropMarker();
    },
    ondrop: (e: DragEvent) => {
      const dragNode = treeDrag;
      if (dragNode === undefined)
        return;
      e.preventDefault();
      const marker = dropMarker;
      treeDrag = undefined;
      clearDropMarker();
      props.on.drop({
        node: marker?.node ?? {key: "", label: ""},
        dragNode,
        dropPosition: marker?.pos ?? "inside",
      });
    },
  }, rows.map(renderRow));
};

export function StatusLabel() {
  const el = m("div", {style: {fontSize: ".8em", whiteSpace: "pre-wrap"}});
  return {
    el,
    setStatus(message: string, isSuccess: boolean) {
      el.textContent = message;
      el.style.color = isSuccess ? "var(--green)" : "var(--err)";
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
