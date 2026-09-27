import * as t from "@/types.ts";
import {none, Option, some} from "@/option.ts";
import {NTag, NTree, TreeOption, treeLabelClass} from "../components/dataview.ts";
import {NScrollbar} from "../components/layout.ts";
import {store} from "../store.ts";
import {DOMNode, m, signal} from "../lib/utils.ts";
import {useLocalStorage} from "../lib/localStorage.ts";
import {css} from "../lib/styles.ts";
import {changed} from "../plugins/cache.ts";
import {ensureFresh, kindTag, pluginsByKind} from "../plugins/index.ts";
import {showContextMenu} from "./contextMenu.ts";

function basename(id: string): string {
  return id.split("/").pop() ?? "";
}

function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}

const byLabel = (a: TreeOption, b: TreeOption): number => a.label.localeCompare(b.label);

// Virtual children of source requests: "loading"/"empty" placeholders or real
// items addressed as `virtual:<Kind value>:<sourceID>:<itemKey...>` with
// path-joined segments for nested items.
type VirtualKey = {
  kind: string,
  sourceID: string,
  segments: string[],
};

function parseVirtualKey(key: string): Option<VirtualKey> {
  const parts = key.split(":");
  if (parts.length < 4 || parts[0] !== "virtual")
    return none;
  const [, kind, sourceID, ...segments] = parts;
  return some({kind, sourceID, segments});
}

// Click resolution for virtual items: parse segments, walk cached items level
// by level via itemKey (and childrenOf for future nested plugins), then hand
// the leaf item to the plugin's onOpen.
async function resolveVirtual(kind: string, sourceID: string, segments: string[]): Promise<void> {
  const plugin = pluginsByKind[kind as t.Kind];
  if (plugin.itemKey === undefined || segments.length === 0)
    return;
  let items = plugin.cache?.get(sourceID)?.items;
  if (items === undefined)
    return;
  let item: unknown = undefined;
  for (const segment of segments) {
    const index = items.findIndex((candidate, i) => plugin.itemKey?.(candidate, i) === segment);
    if (index === -1)
      return;
    item = items[index];
    items = plugin.childrenOf === undefined ? [] : await plugin.childrenOf(item);
  }
  if (item === undefined)
    return;
  await plugin.onOpen?.(sourceID, item, segments.join(":"));
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

  function updateTree() {
    const requestsTree = store.requestsTree.value;
    // Save scroll position before update
    const scrollContainer = treeContainer.querySelector(".n-scrollbar-container");
    const scrollTop = scrollContainer?.scrollTop ?? 0;

    const data = (() => {
      const mapper = (tree: t.Tree): TreeOption[] => [
        ...Object.entries(tree.Dirs).map(([k, v]): TreeOption => ({
          key: k,
          label: basename(k),
          children: mapper(v),
        })),
        ...tree.IDs.map(id => {
            const req = store.requests[id];
            const children: TreeOption[] | undefined = (() => {
              const plugin = pluginsByKind[req.kind];
              if (plugin.cache === undefined || plugin.itemKey === undefined)
                return undefined;
              const entry = plugin.cache.get(id);
              if (entry !== undefined && entry.items.length > 0) {
                return entry.items.map((item, index) => ({
                  key: `virtual:${plugin.kind}:${id}:${plugin.itemKey?.(item, index) ?? ""}`,
                  label: plugin.label?.(item) ?? "",
                })).sort(byLabel);
              }
              // Show "Loading..." or "(None)" based on loading state, kept
              // disabled so it is not clickable. Node stays expandable (folder).
              const isLoading = entry?.loading ?? false;
              return [{
                key: `virtual:${isLoading ? "loading" : "empty"}:${id}:${plugin.kind}`,
                label: isLoading ? "Loading..." : "(None)",
                disabled: true,
              }];
            })();

            return {
              key: id,
              label: t.pathToName(store.requests[id].path),
              ...(children !== undefined ? {children} : {}), // Only set children for requests with source caches
            };
        }),
      ].sort(byLabel);
      return mapper(requestsTree);
    })();

    treeContainer.replaceChildren(NScrollbar(
      NTree({
        defaultExpandedKeys: expandedKeysSignal.value,
        data,
        on: {
          "update:expanded-keys": async (keys: string[]) => {
            const oldKeys = expandedKeysSignal.value;
            expandedKeysSignal.update(() => keys);

            // Fetch data for sources that were just expanded (staleness/loading guarded inside ensureFresh)
            await ensureFresh(keys.filter(key => !oldKeys.includes(key)));
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
              resolveVirtual(kind, sourceID, segments);
            } else {
              store.selectRequest(id);
            }
          },
        },
        render: (option: TreeOption, _level: number, _expanded: boolean): DOMNode => {
          const virtual = parseVirtualKey(option.key);
          if (virtual.isSome()) {
            const {kind, sourceID, segments} = virtual.value;
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
            const plugin = pluginsByKind[kind as t.Kind];
            if (plugin.cache !== undefined && plugin.itemKey !== undefined) {
              // Generic item row: tag from the plugin's tag hook + shared ellipsized label
              const leaf = segments[segments.length - 1];
              const item = plugin.cache.get(sourceID)?.items.find((candidate, index) => plugin.itemKey?.(candidate, index) === leaf);
              const tagData = item !== undefined && plugin.tag !== undefined ? plugin.tag(item) : undefined;
              return m("span", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                },
              },
              ...(tagData !== undefined ? [NTag({
                type: tagData.type,
                style: {
                  minWidth: "2em",
                  justifyContent: "center",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: "bold",
                  padding: "2px 4px",
                  ...tagData.style,
                },
              }, tagData.text)] : []),
              m("span", {
                style: {
                  flex: "1",
                  minWidth: "0",
                  color: "#e0e0e0",
                  overflow: "clip",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
                title: option.label,
              }, option.label));
            }
          }

          // Handle requests (including sources)
          if (option.key in store.requests) {
            const req = store.requests[option.key];
            const tag = kindTag(req.kind);

            // Check if this source is currently loading
            const isLoading = pluginsByKind[req.kind].cache?.get(option.key)?.loading ?? false;

            // The tree component automatically adds folder icon for items with children
            // We just need to render the badge and label

            return [
              NTag({
                type: tag.type ?? "info",
                class: isLoading ? pulseClass : undefined,
                style: {
                  minWidth: "4em",
                  justifyContent: "center",
                  display: "flex",
                  alignItems: "center",
                  color: tag.color,
                  fontWeight: "bold",
                  padding: "2px 4px",
                  backgroundColor: "#202020",
                },
              }, tag.text),
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
      }),
    ));

    // Restore scroll position after DOM update
    if (scrollTop > 0) {
      setTimeout(() => {
        const newScrollContainer = treeContainer.querySelector(".n-scrollbar-container");
        if (newScrollContainer !== null) {
          newScrollContainer.scrollTop = scrollTop;
        }
      }, 0);
    }
  }

  changed.sub(function*() {while (true) { yield; updateTree(); }}());

  store.requestsTree.sub(function*() {
    while (true) {
      yield;
      updateTree();
      // Fetch data for expanded sources when requests tree updates
      // (e.g., when store.fetch() loads requests on app startup)
      ensureFresh(expandedKeysSignal.value).catch(err => {
        console.error("Failed to fetch expanded sources:", err);
      });
    }
  }());
  expandedKeysSignal.sub(function*() {while (true) { yield; updateTree(); }}());

  return {el: treeContainer};
}
