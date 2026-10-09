# Adding New Plugins to Apiary

This guide explains how to add a new request kind plugin to apiary.

## Overview

Every request kind (HTTP, SQL, gRPC, Redis, JQ, Markdown, DIFF, MCP, SQLSource, HTTPSource) is a *plugin* with two halves:

- **Backend** (`main/database/<kind>.ts`): a `send<Kind>` function plus an `EmptyRequest` template, dispatched from `main/api.ts`.
- **Frontend** (`renderer/plugins/<kind>/viewer.ts`): a UI factory, wired into the kind's plugin via the `frame` hook in `renderer/plugins/<kind>/index.ts`.

The two halves connect through the typed IPC surface: `main.ts` (handlers) → `preload.ts` (bridge) → `global.d.ts` (`Api` interface).

## Where Things Live

```
shared/types.ts               # Kind enum, <Kind>Request / <Kind>Response types, RequestData / ResponseData / HistoryEntry unions
main/database/<kind>.ts       # Plugin implementation: send<Kind> + EmptyRequest
main/database/<kind>.test.ts  # Plugin unit tests
main/api.ts                   # emptyRequestForKind + Perform dispatch (or a sub-API namespace)
main/db.ts                    # JSON DB — no changes needed for new kinds (see step 6)
main.ts                       # ipcMain.handle(...) per channel
preload.ts                    # ipcRenderer.invoke(...) mirror, exposed via contextBridge
global.d.ts                   # Api interface — the typed IPC contract
renderer/plugins/<kind>/viewer.ts   # UI factory (default export) + colocated component test
renderer/plugins/<kind>/index.ts    # Plugin module: frame, root (kind badge), menus, source cache (see step 7)
renderer/plugins/index.ts           # Central registry — register the new plugin here
renderer/App.ts               # panelkaFactory (kind → plugin.frame dispatch)
```

## Step-by-Step Implementation

### 1. Types (`shared/types.ts`)

Add the kind and its data shapes:

```typescript
export enum Kind {
  // ... existing kinds
  Example = "example",
}

export type ExampleRequest = {
  field1: string,
  field2: number,
};

export type ExampleResponse = {
  result: string,
};

export type RequestData =
  // ... existing members
  | {kind: Kind.Example} & ExampleRequest
;
```

If the kind is performable (it has a `Perform` action), also add `ExampleResponse` to the `ResponseData` and `HistoryEntry` unions in the same file. Source kinds (like SQLSource, HTTPSource, MCP) have a `RequestData` member only — their data is fetched on demand through dedicated IPC endpoints, not through response history, and they expose their browsable items through their plugin (step 7).

### 2. Backend Plugin (`main/database/example.ts`)

Each plugin is a module exporting an `EmptyRequest` constant and a `send<Kind>` function. Minimal real example (`main/database/jq.ts`):

```typescript
import type {JQRequest, JQResponse} from "@/types.ts";
import {jq} from "@/jq.ts";

export const EmptyRequest: JQRequest = {
  query: ".",
  json: `{ ... }`,
};

export async function sendJQ({json, query}: JQRequest): Promise<JQResponse> {
  return {response: await jq(json, query)};
}
```

`send<Kind>` may be sync (e.g. `sendDIFF` returns `DIFFResponse` directly) or async. Add unit tests in `main/database/example.test.ts` next to the module (see `main/database/jq.test.ts` for the pattern: `bun:test` with `mock.module` for external dependencies).

### 3. Dispatch (`main/api.ts`)

**Performable kinds** — add a case in both switches:

- `emptyRequestForKind(kind)`: return the empty request. Import the plugin's `EmptyRequest` if it has meaningful defaults (HTTP, SQL, JQ, MD, REDIS, MCP, SQLSource), or return an inline object for trivially-structured kinds (GRPC, DIFF, HTTPSource).
- `Perform(id)`: call `await sendExample(req.Data)`. After the switch, `createResponse(j, id, {SentAt, ReceivedAt, Response})` persists the exchange into the entry's response history automatically for every dispatched kind.

**Source kinds** — skip `Perform` and add a dedicated sub-API namespace instead, mirroring `export const GRPC = {...}` / `SQLSource` / `HTTPSource` / `MCP` in `main/api.ts`:

```typescript
export const Example = {
  ListThings: async (id: t.RequestID): Promise<Thing[]> => {
    // load entry, validate Kind, call plugin helpers
  },
};
```

### 4. IPC Surface (`main.ts` + `preload.ts` + `global.d.ts`)

Add one handler per channel in `main.ts`:

```typescript
ipcMain.handle("Example.ListThings", (_, id: string) => api.Example.ListThings(id));
```

Mirror it in `preload.ts` inside the `api: Api` object:

```typescript
Example: {
  ListThings: (a1: string): Promise<Thing[]> => ipcRenderer.invoke("Example.ListThings", a1),
},
```

And extend the `Api` interface in `global.d.ts` (this is what makes `window.api.Example.ListThings` type-safe in the renderer):

```typescript
Example: {
  ListThings: (_1: string) => Promise<Thing[]>,
},
```

### 5. Frontend Module (`renderer/plugins/<kind>/viewer.ts`)

Default-export a factory following the existing pattern (see `renderer/plugins/diff/viewer.ts` for a full reference):

```typescript
export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: t.HistoryEntry): void,
  unmount(): void,
} {
  // build DOM with m(), state with signal(), editors from ./components/editor.ts
  return {loaded, push_history_entry, unmount};
}
```

Conventions:

- Build DOM with `m()` from `renderer/lib/utils.ts` (no VDOM).
- Use `signal<T>()` only for watched state; plain locals otherwise.
- Styles via `css`/`css.raw` from `renderer/lib/styles.ts`.
- Errors render above the main content (see the hidden `el_error` pattern in `plugins/diff/viewer.ts`).
- For auto-computing kinds, debounce rapid updates (500ms, as in `plugins/diff/viewer.ts`).
- Clean up listeners/editors in `unmount()`.
- Add component tests in `renderer/plugins/<kind>/viewer.test.ts` (see `renderer/plugins/diff/viewer.test.ts` and `renderer/components/CommandPalette.test.ts` for the `bun:test` + `happy-dom` pattern).

### 6. Registration (`renderer/plugins/<kind>/`)

Wire the UI module into the plugin's `frame` hook:

```typescript
import RequestExample from "./viewer.ts";

// performable kind:
frame: (args) => RequestExample(args.el, args.show_request, args.on),

// source kind (no send/eye — they query sources on demand):
frame: (args) => {
  setDisplay(args.eye, false);
  return RequestExample(args.el, {update: args.on.update});
},
```

Source panes that display fetched data also ship a viewer component and expose it through the plugin's `viewer` hook — shared viewers stay in `renderer/components/` (e.g. `TableView.ts`, `EndpointViewer.ts`), kind-specific ones colocate in the plugin dir (e.g. `plugins/mcp/tool.ts`). `App.ts` builds the layout factories from the registry, so no per-viewer edit is needed there.

**No `main/db.ts` changes are needed**: the v1 migration switch in `db.ts` only handles kinds that existed in v1 databases; new kinds never appear there (`Create` writes the current format directly).

### 7. Plugin (`renderer/plugins/`)

Every request kind registers a `Plugin` under `renderer/plugins/<kind>/` (a whole-app plugin, not just a sidebar entry): `index.ts` holds the `Plugin` object, `viewer.ts` the frame UI factory, extra kind-specific viewer components and colocated tests live alongside. The sidebar (tree children, click handling, item tags, the context-menu Refresh entry, staleness) renders generically from the registry; source kinds additionally provide a `SourceCache` for their browsable items.

Plain (performable) kind — `renderer/plugins/http/index.ts`:

```typescript
import * as t from "@/types.ts";
import type {Plugin} from "../cache.ts";
import RequestHTTP from "./viewer.ts";

export const httpPlugin: Plugin = {
  kind: t.Kind.HTTP,
  root: () => ({key: "", label: "", badge: {text: "HTTP", color: "lime", type: "success"}}),
  frame: (args) => RequestHTTP(args.el, args.show_request, args.on),
  menuEntries: (id) => [copyAsCurl(id)],   // optional per-kind context-menu entries
};
```

Source kind — `renderer/plugins/sql_source/index.ts` (adds the cache, item hooks and viewer):

```typescript
import * as t from "@/types.ts";
import {createSourceCache, type Plugin} from "../cache.ts";
import {api} from "../../api.ts";
import {store} from "../../store.ts";
import RequestSQLSource from "./viewer.ts";
import RequestTableViewer from "../../components/TableView.ts";

const componentType = "TableViewer";
type StateSQLSourceTable = {
  sourceID: string,
  itemKey: string,
  tableName: string,
  tableInfo: t.TableInfo,
};

export const sqlSourcePlugin: Plugin<t.TableInfo> = {
  kind: t.Kind.SQLSource,
  root: id => ({key: "", label: "", badge: {text: "SQL*", color: "#70a0e8"}, /* + listing thunks */ }),
  frame: (args) => {
    setDisplay(args.eye, false);
    return RequestSQLSource(args.el, {update: args.on.update});
  },
  cache: createSourceCache<t.TableInfo>({
    fetcher: id => api.requestListTablesSQLSource(id),   // Promise<Result<TableInfo[]>>
    errorTitle: "Could not fetch tables",
  }),
  itemKey: table => table.name,
  label: table => formatTableLabel(table),
  tag: () => ({text: "TBL", type: "info"}),
  viewer: {
    componentType,
    factory: (container, state) => RequestTableViewer(container, state as StateSQLSourceTable),
  },
  onOpen: (id, table, itemKey) =>
    store.openViewer(componentType, itemKey, {sourceID: id, itemKey, tableName: itemKey, tableInfo: table}),
};
```

Register it — the only sidebar-related edit outside `renderer/plugins/`:

```typescript
// renderer/plugins/index.ts
import {httpPlugin} from "./http";
// ...
export const plugins = [httpPlugin, /* ... */ sqlSourcePlugin, httpSourcePlugin, mcpPlugin];
```

Contract:

| Field | Applies to | Required | Meaning |
|-------|-----------|----------|---------|
| `kind` | all kinds | yes | Registry key (the `t.Kind` value); also the virtual-key segment: `virtual:<kind>:<sourceID>:<itemKey>` |
| `root` | all kinds | yes | Invisible `RootItem` carrying the kind badge `{text, color, type?}`; source kinds give it `children`/`loading`/`refresh` listing thunks |
| `menuEntries` | all kinds | no | Per-kind context-menu entries (e.g. HTTP → Copy as curl) |
| `cache` | source kinds | no | `SourceCache<T>` built by `createSourceCache(fetcher, errorTitle)`; its presence enables tree children and the Refresh entry |
| `fetcher` / `errorTitle` | source kinds | via `createSourceCache` | IPC call returning `Result<Item[]>`; notification title on fetch failure |
| `itemKey` | source kinds | with cache | Unique key per item among its siblings (name; or index when items are unkeyed) |
| `label` | source kinds | with cache | Display label (plain string, no DOM) |
| `tag` | source kinds | with cache | Per-item tag data `{text, type, style?}` rendered by the generic tree row |
| `onOpen` | source kinds | no | Click action for leaf items, called as `(id, item, itemKey)` (the `itemKey` carries the index for unkeyed items). Group nodes omit it |
| `viewer` | source kinds | no | `{componentType, factory}` — mounts the item's viewer pane. `componentType` is the layout component name persisted in saved layouts (dedup key together with `{sourceID, itemKey}`, see `store.openViewer`, which also composes the `sourceName/` title prefix); `factory(container, state)` builds the component. `App.ts` derives all viewer factories from the registry |
| `childrenOf` | source kinds | no | `(item) => Promise<Item[]>` — children of a group item; absent/empty → leaf. Enables nesting (e.g. source → tables/views groups → concrete items) |

Rules:

- `itemKey`, `label`, `tag` are **sync** mappings over data already in the cache — for anything async, fetch into the cache and bump the `changed` signal; never make these hooks async.
- The cache stores a flat `Item[]`; grouping and nesting are `childrenOf`'s job.
- Virtual keys are path-joined (`virtual:<kind>:<sourceID>:<groupKey>:<itemKey>`) and are only safe to rename while virtual nodes are leaves (leaves are not persisted in `localStorage("expanded-keys")`).
- Do not edit `renderer/sidebar/` when adding a kind — nothing there references individual kinds.

### 8. Post-Implementation Checks

```bash
bun run test             # unit + component tests
bun run test:integration # INTEGRATION=1 bun test integration.test.ts
bun run ci               # lint + typecheck
bun run build
bun run test:e2e         # builds first, then Playwright (renderer/e2e/)
bun run dist             # package the app
```

Manual end-to-end:

1. Launch the app.
2. Create a new request of the new kind.
3. Perform it; verify the response appears and lands in history.
4. Close and restart; verify the request and its history persist in `db.json`.

## Reference Example: DIFF

The DIFF kind is a good end-to-end reference:

- `shared/types.ts`: `Kind.DIFF = "diff"`, `DIFFRequest {left, right}`, `DIFFResponse {diff, stats, leftType, rightType}`, plus `ResponseData`/`HistoryEntry` members.
- `main/database/diff.ts`: sync `sendDIFF` (JSON structural diff or line diff via the `diff` package) + `diff.test.ts`.
- `main/api.ts`: inline `emptyRequestForKind` case `{left: "", right: ""}` and a `Perform` case.
- `renderer/plugins/diff/viewer.ts`: default-export factory, split panes, 500ms debounced auto-perform, error banner above content.
- `renderer/plugins/diff/index.ts` + registration in `renderer/plugins/index.ts`: `frame` dispatch (no `App.ts` edit — `panelkaFactory` routes via the registry).

## Best Practices

1. Keep plugin modules free of Electron imports so they stay unit-testable.
2. Exact assertions in tests (equality, not substring contains).
3. Make `emptyRequestForKind` defaults useful — the empty request is what users see on create.
4. Keep the `Api` interface in `global.d.ts` as the single source of truth; `preload.ts` and `main.ts` must stay in sync with it (the typechecker enforces this via `bun run ci`).