import * as t from "@/types.ts";
import {NTag, NTree, TreeOption, treeLabelClass} from "../components/dataview.ts";
import {NScrollbar} from "../components/layout.ts";
import {store} from "../store.ts";
import {DOMNode, m, signal} from "../lib/utils.ts";
import {useLocalStorage} from "../lib/localStorage.ts";
import {css} from "../lib/styles.ts";
import {changed} from "../plugins/cache.ts";
import {byLabel, parseVirtualKey, sourceBadge, sourceChildren, sourceIsLoading, sourceResolve} from "../plugins/source.ts";
import {showContextMenu} from "./contextMenu.ts";

function basename(id: string): string {
  return id.split("/").pop() ?? "";
}

function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}

const expandedKeys = useLocalStorage<string[]>("expanded-keys", []);
const expandedKeysSignal = signal(expandedKeys.value);
expandedKeysSignal.sub(function*() {
  while (true) {
    const keys = yield;
    expandedKeys.value = keys;
  }
}());

function drag({node, dragNode, dropPosition}: {
  node: TreeOption,
  dragNode: TreeOption,
  dropPosition: "before" | "inside" | "after",
}): void  {
  const dir = (d: string): string => d === "" ? "" : d + "/";
  const oldID = dragNode.key;
  const into = node.key;
  switch (dropPosition) {
    case "before":
    case "after":
      store.rename(oldID, dir(dirname(into)) + basename(oldID));
      break;
    case "inside":
      store.rename(oldID, dir(into) + basename(oldID));
      break;
  }
}

// pulse keyframes + class for loading state
const pulseClass = css.raw(` {
  animation: pulse 1.5s infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}`);

export function createTreeView(): {el: HTMLElement} {
  const treeContainer = m("div", {style: {minHeight: "0"}});
  const scrollContainer = NScrollbar();
  treeContainer.replaceChildren(scrollContainer);

  function updateTree() {
    const requestsTree = store.requestsTree.value;
    const expandedSet = new Set(expandedKeysSignal.value);

    const data = (() => {
      const mapper = (tree: t.Tree): TreeOption[] => [
        ...Object.entries(tree.Dirs).map(([k, v]): TreeOption => ({
          key: k,
          label: basename(k),
          children: mapper(v),
        })),
        ...tree.IDs.map(id => {
            // Children of source requests materialize lazily along expanded
            // paths (their listing thunks fetch when stale); kinds without
            // source items keep children unset
            const children = sourceChildren(id, expandedSet);

            return {
              key: id,
              label: t.pathToName(store.requests[id].path),
              ...(children !== undefined ? {children} : {}), // Only set children for requests with source items
              loading: sourceIsLoading(id),
            };
        }),
      ].sort(byLabel);
      return mapper(requestsTree);
    })();

    scrollContainer.replaceChildren(NTree({
      defaultExpandedKeys: expandedKeysSignal.value,
      data,
      on: {
        "update:expanded-keys": (keys: string[]) => {
          // Rebuilding happens in the expandedKeysSignal subscription below;
          // materializing the newly expanded paths fires their listing fetches
          expandedKeysSignal.update(() => keys);
        },
        drop: drag,
        context_menu: (option: TreeOption, event: MouseEvent) => {
          showContextMenu(option.key, event);
        },
        click: (v: TreeOption) => {
          const id = v.key;

          // Skip disabled items like "(None)" and "loading" items
          if (v.disabled ?? false) return;

          const virtual = parseVirtualKey(id);
          if (virtual.isSome()) {
            const {kind, sourceID, segments} = virtual.value;
            // Skip "loading" and "empty" placeholders (also disabled above)
            if (kind === "loading" || kind === "empty")
              return;
            sourceResolve(sourceID, segments);
          } else {
            store.selectRequest(id);
          }
        },
      },
      render: (option: TreeOption, _level: number, _expanded: boolean): DOMNode => {
        const virtual = parseVirtualKey(option.key);
        if (virtual.isSome()) {
          const {kind} = virtual.value;
          switch (kind) {
          case "empty":
            // "(None)" item - simple text, disabled, no badge, no hover effects
            return m("span", {
              style: {
                display: "flex",
                alignItems: "center",
                width: "100%",
                opacity: "0.6",
                color: "#808080",
                fontStyle: "italic",
                pointerEvents: "none", // TODO: move into parent element
              },
            }, "(None)");
          case "loading":
            // "Loading..." item - not disabled, shows loading state
            return m("span", {
              class: pulseClass,
              style: {
                display: "flex",
                alignItems: "center",
                width: "100%",
                color: "#a0a0a0",
                fontStyle: "italic",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                overflow: "clip",
              },
              title: "Loading...",
            }, "Loading...");
          }
          // Generic source item row: tag baked at materialization (leaves and
          // virtual folders render without a tag) + shared ellipsized label
          return m("span", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
            },
          },
          ...(option.tag !== undefined ? [NTag({
            label: option.tag.label,
            color: option.tag.color,
            background: option.tag.background,
            style: {
              minWidth: "2em",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              fontWeight: "bold",
              padding: "2px 4px",
            },
          })] : []),
          NTag({
            label: option.label,
            tooltip: option.label,
            color: "#e0e0e0",
            style: {
              flex: "1",
              minWidth: "0",
              overflow: "clip",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }));
        }

        // Handle requests (including sources)
        if (option.key in store.requests) {
          const tag = sourceBadge(option.key);

          // The tree component automatically adds folder icon for items with children
          // We just need to render the badge and label; loading is baked into
          // the option during materialization

          return [
            NTag({
              label: tag.label,
              color: tag.color,
              background: tag.background,
              class: (option.loading ?? false) ? pulseClass : undefined,
              bordered: true,
              style: {
                minWidth: "4em",
                justifyContent: "center",
                display: "flex",
                alignItems: "center",
                fontWeight: "bold",
                padding: "1px 0px",
                margin: "1px 6px",
              },
            }),
            m("span", {
              style: {
                flex: "1",
                minWidth: "0",
                color: "#e0e0e0",
                overflow: "clip",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                cursor: "pointer",
                alignContent: "center",
                paddingLeft: "4px",
              },
              onclick: (e: MouseEvent) => {
                e.stopPropagation();
                store.selectRequest(option.key);
              },
              title: option.label,
            }, option.label),
          ];
        }

        // Handle directories (regular folders) - fallback
        if (option.children !== undefined) {
          return m("span", {
            class: treeLabelClass,
            style: {
              overflow: "clip",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            title: option.label,
          }, option.label);
        }

        return null;
      },
    }));
  }

  changed.sub(function*() {while (true) { yield; updateTree(); }}());

  store.requestsTree.sub(function*() {
    while (true) {
      yield;
      // Rebuilding also refreshes expanded source listings: their listing
      // thunks fetch when stale during materialization (e.g. on app startup)
      updateTree();
    }
  }());
  expandedKeysSignal.sub(function*() {while (true) { yield; updateTree(); }}());

  return {el: treeContainer};
}
