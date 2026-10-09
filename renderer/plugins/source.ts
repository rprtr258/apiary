import * as t from "@/types.ts";
import {store} from "../store.ts";
import {pluginsByKind} from "./index.ts";
import type {TreeOption} from "../components/dataview.ts";
import {ItemBadge, Plugin} from "./types.ts";
import {none, Option, some} from "@/option.ts";

// A node of the sidebar source subtree returned by Plugin.root(id). The root
// itself is invisible (never rendered, key/label unused); the facade renders
// its children under the source request row. Factories must be pure — they
// only build closures; all effects belong in the thunks below.
export type Item = {
  key: string, // identity; keys containing "/" are nested into folder chains
  label: string,
  badge?: ItemBadge,
  onOpen?(): void, // click action; closure captures (sourceID, item data, itemKey)
  children?(): Item[], // lazy thunk; listing thunks fire staleness-guarded fetches and return the current items
  loading?(): boolean, // listing in flight — drives "Loading..." placeholders and the request-row pulse
  refresh?(): Promise<void>, // forced fetch; presence on the root = "Refresh" context-menu entry
};

// Sidebar address of a source node: "virtual:<kind>:<sourceID>:<segments...>".
// kind may also be the "loading"/"empty" placeholder markers.
export type VirtualKey = {
  kind: string,
  sourceID: string,
  segments: string[],
};

// ":" is the segment separator, so it (and the escape character) are escaped
// per segment — item keys like HTTP "GET /user/:id" survive a round trip.
const escapeSegment = (segment: string): string =>
  segment.replace(/\\/g, "\\\\").replace(/:/g, "\\:");

export function composeVirtualKey(kind: string, sourceID: string, segments: string[]): string {
  return ["virtual", kind, sourceID, ...segments.map(escapeSegment)].join(":");
}

export function parseVirtualKey(key: string): Option<VirtualKey> {
  const prefix = "virtual:";
  if (!key.startsWith(prefix))
    return none;
  // Split on unescaped ":", unescaping as we go
  const parts: string[] = [];
  let current = "";
  let escaped = false;
  for (const ch of key.slice(prefix.length)) {
    if (escaped) {
      current += ch;
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === ":") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (escaped)
    current += "\\";
  parts.push(current);
  if (parts.length < 3)
    return none;
  const [kind, sourceID, ...segments] = parts;
  return some({kind, sourceID, segments});
}

export const byLabel = (a: TreeOption, b: TreeOption): number => a.label.localeCompare(b.label);

// "Loading..."/"(None)" placeholder row: keyed after the placeholder
// convention "virtual:<state>:<sourceID>:<kind>:<path...>" and disabled so it
// is not clickable. The node stays a folder in the tree (its parent keeps it
// as the only child), matching the pre-facade behavior.
function placeholderOption(id: t.RequestID, kind: string, path: string[], item: Item): TreeOption {
  const isLoading = item.loading?.() ?? false;
  return {
    key: ["virtual", isLoading ? "loading" : "empty", id, kind, ...path.map(escapeSegment)].join(":"),
    label: isLoading ? "Loading..." : "(None)",
    disabled: true,
  };
}

function materializeNode(id: t.RequestID, kind: string, path: string[], item: Item, expanded: ReadonlySet<string>): TreeOption {
  const key = composeVirtualKey(kind, id, path);
  const option: TreeOption = {
    key,
    label: item.label,
    ...(item.badge !== undefined ? {tag: item.badge} : {}),
  };
  if (item.children === undefined)
    return option;
  // Folder: thunks run only along expanded paths — collapsed folders keep an
  // empty children array (still expandable in NTree) and are never fetched
  if (!expanded.has(key))
    return {...option, children: []};
  const children = item.children();
  return {
    ...option,
    children: children.length === 0 ?
      [placeholderOption(id, kind, path, item)] :
      nestItems(id, kind, path, children, expanded),
  };
}

// Project a materialized item level into tree options, nesting items whose
// keys contain "/" into virtual folder chains (e.g. "GET /users/:id" becomes
// folders "GET " > "users" with a leaf ":id") exactly like request id paths
// nest into directories.
function nestItems(id: t.RequestID, kind: string, path: string[], items: Item[], expanded: ReadonlySet<string>): TreeOption[] {
  const groups = new Map<string, Item[]>();
  const leaves: Item[] = [];
  for (const item of items) {
    const idx = item.key.indexOf("/");
    if (idx === -1)
      leaves.push(item);
    else {
      const head = item.key.slice(0, idx);
      const rest = {...item, key: item.key.slice(idx + 1)};
      const group = groups.get(head);
      if (group === undefined)
        groups.set(head, [rest]);
      else
        group.push(rest);
    }
  }
  return [
    ...leaves.map(item => materializeNode(id, kind, [...path, item.key], item, expanded)),
    ...groups.entries().map(([segment, group]) => {
      const folder: Item = {
        key: segment,
        label: segment,
        children: () => group,
      };
      return materializeNode(id, kind, [...path, segment], folder, expanded);
    }),
  ].sort(byLabel);
}

// Children of a source request row: lazily materialized from the plugin's
// invisible root. Nothing is fetched while the row is collapsed.
export function sourceTree(id: t.RequestID, kind: string, root: Item, expanded: ReadonlySet<t.RequestID>): TreeOption[] {
  if (!expanded.has(id))
    return [];
  const children = root.children?.() ?? [];
  if (children.length === 0)
    return [placeholderOption(id, kind, [], root)];
  return nestItems(id, kind, [], children, expanded);
}

// Click resolution for virtual items: walk items level by level, matching
// segments against item keys (descending into "/"-prefix groups the same way
// nestItems builds folders, and into structural folders via their children
// thunks), then fire the leaf's onOpen. Unmatched paths are no-ops.
export function resolveIn(items: Item[], segments: string[]): void {
  if (segments.length === 0)
    return;
  const [head, ...rest] = segments;
  const exact = items.find(item => item.key === head);
  if (exact !== undefined) {
    if (rest.length === 0) {
      exact.onOpen?.();
      return;
    }
    if (exact.children !== undefined)
      resolveIn(exact.children(), rest);
    return;
  }
  const prefix = `${head}/`;
  const group = items
    .filter(item => item.key.startsWith(prefix))
    .map(item => ({...item, key: item.key.slice(prefix.length)}));
  if (group.length > 0)
    resolveIn(group, rest);
}

// Facade over the per-kind source items: the single seam the sidebar (tree,
// context menu) consumes. Kinds expose an invisible root Item via
// Plugin.root(id); this module materializes it into TreeOptions gated by the
// tree's expanded keys, so thunks (and their fetches) only run along expanded
// paths.

function pluginFor(id: t.RequestID): Plugin | undefined {
  if (!(id in store.requests))
    return undefined;
  return pluginsByKind[store.requests[id].kind];
}

// Children of the source request row with the given id; undefined for kinds
// without source items (the row keeps children unset). Collapsed rows get an
// empty array (still expandable, nothing fetched).
export function sourceChildren(id: t.RequestID, expanded: ReadonlySet<t.RequestID>): TreeOption[] | undefined {
  const root = pluginFor(id)?.root(id);
  if (root === undefined || root.children === undefined)
    return undefined;
  return sourceTree(id, store.requests[id].kind, root, expanded);
}

// Resolve a parsed virtual key against the root's items and fire the matched
// leaf's onOpen. Unmatched paths are no-ops.
export function sourceResolve(sourceID: string, segments: string[]): void {
  const root = pluginFor(sourceID)?.root(sourceID);
  if (root?.children === undefined)
    return;
  resolveIn(root.children(), segments);
}

export function sourceRefreshable(id: t.RequestID): boolean {
  return pluginFor(id)?.root(id).refresh !== undefined;
}

export function sourceRefresh(id: t.RequestID): Promise<void> {
  return pluginFor(id)?.root(id).refresh?.() ?? Promise.resolve();
}

export function sourceIsLoading(id: t.RequestID): boolean {
  return pluginFor(id)?.root(id).loading?.() ?? false;
}

// Kind badge of a request: carried by the kind's root item; the sidebar
// request rows and the command palette consume it through this facade.
export function sourceBadge(id: t.RequestID): ItemBadge {
  return pluginFor(id)?.root(id).badge ?? {label: "", color: ""};
}
