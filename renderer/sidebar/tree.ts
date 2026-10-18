import * as t from "@/types.ts";
import {NTag, NTree, TreeOption, treeLabelClass} from "../components/dataview.ts";
import {NScrollbar} from "../components/layout.ts";
import {store} from "../store.ts";
import {DOMNode, m, signal} from "../lib/utils.ts";
import {useLocalStorage} from "../lib/localStorage.ts";
import {css} from "../lib/styles.ts";
import {changed} from "../plugins/cache.ts";
import {parseVirtualKey, sourceBadge, sourceChildren, sourceIsLoading, sourceResolve} from "../plugins/source.ts";
import {dropToMove} from "./drop.ts";
import {showContextMenu} from "./contextMenu.ts";

const expandedKeys = useLocalStorage<string[]>("expanded-keys", []);
const expandedKeysSignal = signal(expandedKeys.value);
expandedKeysSignal.sub(function*() {
  while (true) {
    const keys = yield;
    expandedKeys.value = keys;
  }
}());

function drag(drop: {
  node: TreeOption,
  dragNode: TreeOption,
  dropPosition: "before" | "inside" | "after",
}): void {
  // Virtual rows are neither draggable nor drop targets (enforced by NTree);
  // this keeps the contract explicit at the boundary
  if (parseVirtualKey(drop.dragNode.key).isSome() || parseVirtualKey(drop.node.key).isSome())
    return;
  const move = dropToMove(store.requests, store.requestsTree.value, drop);
  if (move === undefined)
    return;
  // Reveal the moved item's new location before the fetch-driven rebuild
  if (move.expand.length !== 0) {
    const keys = new Set(expandedKeysSignal.value);
    for (const dir of move.expand)
      keys.add(dir);
    expandedKeysSignal.value = [...keys];
  }
  store.move(move.drag, move.toDir, move.order, move.renames);
}

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
  // flexGrow fills the pane with the (NTree-owned) root drop zone even when
  // the tree is short; minHeight 0 keeps the scrollbar shrinking in flex
  const treeContainer = m("div", {style: {minHeight: "0", flexGrow: "1"}});
  const scrollContainer = NScrollbar();
  treeContainer.replaceChildren(scrollContainer);

  function updateTree() {
    const requestsTree = store.requestsTree.value;
    const expandedSet = new Set(expandedKeysSignal.value);

    const data = (() => {
      // Children render in the order List() emitted (manual order plus
      // name-sorted fallback); dir keys are full paths, so same-named dirs in
      // different parents keep distinct expanded keys
      const mapper = (tree: t.Tree, prefix: string): TreeOption[] => tree.entries.map((entry): TreeOption => {
        if (entry.kind === "dir") {
          const key = prefix === "" ? entry.name : prefix + "/" + entry.name;
          return {
            key,
            label: entry.name,
            children: mapper(entry.tree, key),
          };
        }
        // Children of source requests materialize lazily along expanded
        // paths (their listing thunks fetch when stale); kinds without
        // source items keep children unset
        const id = entry.id;
        const children = sourceChildren(id, expandedSet);

        return {
          key: id,
          label: t.pathToName(store.requests[id].path),
          ...(children !== undefined ? {children} : {}),
          loading: sourceIsLoading(id),
        };
      });
      return mapper(requestsTree, "");
    })();

    scrollContainer.replaceChildren(NTree({
      defaultExpandedKeys: expandedKeysSignal.value,
      data,
      on: {
        "update:expanded-keys": (keys: string[]) => {
          // Rebuilding happens in the expandedKeysSignal subscription below;
          // materializing the newly expanded paths fires their listing fetches
          expandedKeysSignal.value = keys;
        },
        drop: drag,
        context_menu: (option: TreeOption, event: MouseEvent) => {
          showContextMenu(option.key, event);
        },
        click: (v: TreeOption) => {
          const id = v.key;

          if (v.disabled ?? false) return;

          const virtual = parseVirtualKey(id);
          if (virtual.isSome()) {
            const {kind, sourceID, segments} = virtual.value;
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
