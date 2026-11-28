# Adding New Plugins to Apiary

This guide explains how to add a new request kind plugin to apiary.

## Overview

Every request kind (HTTP, SQL, gRPC, Redis, JQ, Markdown, DIFF, MCP, SQLSource, HTTPSource) is a *plugin* with two halves:

- **Backend** (`main/database/<kind>.ts`): a `send` function plus an `EmptyRequest` template, dispatched from `main/api.ts`.
- **Frontend** (`renderer/plugins/<kind>/viewer.ts`): a UI factory, wired into the kind's plugin via the `frame` hook in `renderer/plugins/<kind>/index.ts`.

The two halves connect through the typed IPC surface: `main.ts` (handlers) → `preload.ts` (bridge) → `global.d.ts` (`Api` interface).

## Where Things Live

```
shared/types.ts               # Kind enum, <Kind>Request / <Kind>Response types, KindTypes table (derived unions)
main/database/<kind>.ts       # Plugin implementation: send + EmptyRequest
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

export type KindTypes = {
  // ... existing rows
  [Kind.Example]: {request: ExampleRequest, response: ExampleResponse},
};
```

The `response` field is what makes a kind performable and draftable: `RequestData`, `HistoryEntry`, `DraftableKind` and the db storage envelope all derive from the `KindTypes` table. Source kinds (like SQLSource, HTTPSource, MCP) have a row without `response` — their data is fetched on demand through dedicated IPC endpoints, and they expose their browsable items through their plugin (step 7).

### 2. Backend Plugin (`main/database/example.ts`)

Each plugin is a module exporting an `EmptyRequest` constant and a `send` function. Minimal real example (`main/database/jq.ts`):

```typescript
import type {JQRequest, JQResponse} from "@/types.ts";
import {jq} from "@/jq.ts";

export const EmptyRequest: JQRequest = {
  query: ".",
  json: `{ ... }`,
};

export async function send({json, query}: JQRequest): Promise<JQResponse> {
  return {response: await jq(json, query)};
}
```

`send` may be sync (e.g. `diff.ts`'s returns `DiffResponse` directly) or async. Add unit tests in `main/database/example.test.ts` next to the module (see `main/database/jq.test.ts` for the pattern: `bun:test` with `mock.module` for external dependencies).

### 3. Dispatch (`main/api.ts`)

**Performable kinds** — add a case in both switches:

- `emptyRequestForKind(kind)`: return the plugin's `EmptyRequest` constant (every plugin exports one).
- `Perform(id)`: call `await example.send(req.Data)` (the plugin module imported as `import * as example from "./database/example.ts"`) and wrap the result with the shared `historyEntry(kind, sent_at, req.Data, response)` helper - the perform wire object is the shared `t.HistoryEntry`; nothing else is persisted.

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
  loaded(r: t.Request): void,
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

// source kind (no editor pane — they query sources on demand):
frame: (args) => RequestExample(args.el, {update: args.on.update}),
```

Performable plugins add the shared eye toggle via `tabModifiers: [eyeTabModifier]` (from `plugins/tab.ts`); source plugins declare no `tabModifiers`, so their tabs carry no eye.
Source panes that display fetched data also ship a viewer component and expose it through the plugin's `viewers` hook — shared viewers stay in `renderer/components/` (e.g. `TableView.ts`, `EndpointViewer.ts`), kind-specific ones colocate in the plugin dir (e.g. `plugins/mcp/tool.ts`). `App.ts` builds the layout factories from the registry, so no per-viewer edit is needed there.

**No `main/db.ts` changes are needed**: the v1 migration switch in `db.ts` only handles kinds that existed in v1 databases; new kinds never appear there (`Create` writes the current format directly).

### 7. Plugin (`renderer/plugins/`)

Every request kind registers a `Plugin` under `renderer/plugins/<kind>/` (a whole-app plugin, not just a sidebar entry): `index.ts` holds the `Plugin` object, `viewer.ts` the frame UI factory, extra kind-specific viewer components and colocated tests live alongside. The sidebar (tree children, click handling, item tags, the context-menu Refresh entry, staleness) renders generically from the registry; source kinds additionally provide a `SourceCache` for their browsable items.

Plain (performable) kind — `renderer/plugins/http/index.ts`:

```typescript
import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestHTTP from "./viewer.ts";

export const httpPlugin: Plugin = {
  kind: t.Kind.HTTP,
  frame: args => RequestHTTP(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],   // shared eye toggle (performable kinds)
  viewers: {},
  menuEntries: id => [copyAsCurl(id)],   // optional per-kind context-menu entries
  root: () => ({key: "", label: "", badge: {label: "HTTP", color: "var(--green)"}}),
};
```

Source kind — `renderer/plugins/sql_source/` (adds the listing and the item viewer):

`index.ts`:

```typescript
import * as t from "@/types.ts";
import {store} from "../../store.ts";
import {Plugin} from "../types.ts";
import {root, componentType, StateSQLSourceTable} from "./item.ts";
import RequestTableViewer from "../../components/TableView.ts";
import RequestSQLSource from "./viewer.ts";

export const sqlSourcePlugin: Plugin = {
  kind: t.Kind.SQLSource,
  frame: args => RequestSQLSource(args.el, {update: args.on.update}),
  viewers: {
    [componentType]: (container, state) => RequestTableViewer(container, state as StateSQLSourceTable),
  },
  menuEntries: id => [/* e.g. "New draft query" */],
  root,   // from item.ts below
};
```

`item.ts` (the sidebar listing):

```typescript
import * as t from "@/types.ts";
import type {Item} from "../source.ts";
import {api} from "../../api.ts";
import {store} from "../../store.ts";
import {createSourceCache, listChildren} from "../cache.ts";

export const componentType = "TableViewer";
export type StateSQLSourceTable = {
  sourceID: string,
  itemKey: string,
  tableName: string,
  tableInfo: t.TableInfo,
};

const tablesCache = createSourceCache<t.TableInfo>(
  id => api.requestListTablesSQLSource(id),   // Promise<Result<TableInfo[]>>
  "Could not fetch tables",
);

function toTableItem(id: string, table: t.TableInfo): Item {
  return {
    key: table.name,
    label: formatTableLabel(table),
    badge: {label: "TBL", color: "var(--accent)"},
    onOpen: () => store.openViewer(table.name, componentType, {
      sourceID: id,
      itemKey: table.name,
      tableName: table.name,
      tableInfo: table,
    }),
  };
}

export function root(id: t.RequestID): Item {
  return {
    key: "",
    label: "",
    badge: {label: "SQL*", color: "var(--accent)"},
    children: () => listChildren(tablesCache, id, t => toTableItem(id, t)),
    loading: () => tablesCache.get(id)?.loading ?? false,
    refresh: () => tablesCache.fetch(id),
  };
}
```

Register it — the only sidebar-related edit outside `renderer/plugins/`:

```typescript
// renderer/plugins/index.ts
import {httpPlugin} from "./http/index.ts";
// ...
export const plugins: Plugin[] = [httpPlugin, /* ... */ sqlSourcePlugin, httpSourcePlugin, mcpPlugin];
```

Contract:

| Field | Applies to | Required | Meaning |
|-------|-----------|----------|---------|
| `kind` | all kinds | yes | Registry key (the `t.Kind` value); also the virtual-key segment: `virtual:<kind>:<sourceID>:...` |
| `frame` | all kinds | yes | Mounts the kind's `viewer.ts` factory into the request pane; source kinds receive only `{update}` (no `show_request`, no eye toggle) |
| `viewers` | all kinds | yes (may be empty) | `componentType` -> factory record for item viewer panes; deduped and titled via `store.openViewer`, which also composes the `sourceName/` title prefix. `App.ts` derives all viewer factories from the registry |
| `root` | all kinds | yes | Invisible `Item` carrying the kind badge `{label, color, background?}`; source kinds give it `children`/`loading`/`refresh` listing thunks |
| `tabModifiers` | performable kinds | no | Tab decorations; the shared eye toggle is `tabModifiers: [eyeTabModifier]` from `plugins/tab.ts` |
| `menuEntries` | all kinds | no | Per-kind context-menu entries (e.g. HTTP → Copy as curl) |

Rules:

- `key`/`label`/`badge` in `toNode` are **sync** mappings over data already in the cache — for anything async, fetch into the cache (the cache's `changed` signal drives the re-render); never make these mappings async.
- The cache stores a flat `Entry[]` of domain data; `listChildren(cache, id, toItem)` serves the entries as `Item`s. Group nodes are plain `Item`s with their own `children` thunks; "/"-containing item keys nest into virtual folder chains.
- Virtual keys are `virtual:<kind>:<sourceID>:<segments>` (`composeVirtualKey`, with `:` escaping per segment so item keys like HTTP `GET /user/:id` round-trip) and are only safe to rename while virtual nodes are leaves (leaves are not persisted in `localStorage("expanded-keys")`).
- Do not edit `renderer/sidebar/` when adding a kind — nothing there references individual kinds.

### 8. Post-Implementation Checks

```bash
bun run test             # unit + component tests
bun run test:integration # INTEGRATION=1 bun test main/integration/
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

- `shared/types.ts`: `Kind.DIFF = "diff"`, `DiffRequest {left, right}`, `DiffResponse {diff, stats, leftType, rightType}`, plus a `KindTypes` table row.
- `main/database/diff.ts`: sync `send` (JSON structural diff or line diff via the `diff` package) + `diff.test.ts`.
- `main/api.ts`: `emptyRequestForKind` case returning `diff.EmptyRequest` and a `Perform` case (`response = diff.send(req.Data)`).
- `renderer/plugins/diff/viewer.ts`: default-export factory, split panes, 500ms debounced auto-perform, error banner above content.
- `renderer/plugins/diff/index.ts` + registration in `renderer/plugins/index.ts`: `frame` dispatch (no `App.ts` edit — `panelkaFactory` routes via the registry).

## Best Practices

1. Keep plugin modules free of Electron imports so they stay unit-testable.
2. Exact assertions in tests (equality, not substring contains).
3. Make `emptyRequestForKind` defaults useful — the empty request is what users see on create.
4. Keep the `Api` interface in `global.d.ts` as the single source of truth; `preload.ts` and `main.ts` must stay in sync with it (the typechecker enforces this via `bun run ci`).