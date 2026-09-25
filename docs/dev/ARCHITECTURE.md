# Apiary Architecture

## Overview

Apiary provides access to multiple APIs (REST/GRPC/databases) in a "two pane" setup (query -> result), plus markdown editor/viewer and diff capabilities. Electron main process executes request plugins; the frontend is vanilla TypeScript with direct DOM APIs. Target: individual developers.

## Directory Structure

```
apiary/
├── main.ts                 # Electron main process: BrowserWindow + ipcMain.handle() wiring
├── preload.ts              # contextBridge: exposes window.api / window.versions to the renderer
├── global.d.ts             # Api interface + window.api declaration (the typed IPC contract)
├── main/                   # Backend (runs in the Electron main process)
│   ├── api.ts              # API façade: entry CRUD, emptyRequestForKind, Perform dispatch, source sub-APIs
│   ├── db.ts               # JSON DB (db.json): entry CRUD, response history, format migration
│   └── database/           # Plugin modules, one file per request kind (+ *_test.ts unit tests)
│       ├── http.ts, sql.ts, grpc.ts, redis.ts, jq.ts, md.ts, diff.ts
│       ├── sql_source.ts, http_source.ts, mcp.ts
│       └── connection_pool.ts # generic connection pool engine (shared by mcp.ts, redis.ts and the sql.*.ts backends)
├── renderer/               # Frontend (vanilla TypeScript, no framework)
│   ├── App.ts              # Layout mount, command palette, keyboard shortcuts, panelkaFactory
│   ├── store.ts            # Central state (requests, layoutConfig, activeComponentID)
│   ├── Sidebar.ts          # Sidebar shell
│   ├── sidebar/            # tree.ts, contextMenu.ts, shared.ts (pure view modules)
│   ├── plugins/            # Frontend plugin registry: index.ts (registry), source.ts (source Item tree, virtual keys, listing facade), cache.ts (source cache engine), one <kind>/ dir per kind (index.ts registration + viewer.ts frame UI)
│   ├── layout/             # Custom layout manager (panes/stacks/tabs/splitters)
│   ├── components/         # Reusable N* components (CommandPalette, TableView, ViewJSON, ...)
│   ├── lib/                # utils.ts (signal, m), styles.ts (css/css.raw), localStorage.ts, notification.ts
│   ├── EditorSQL.ts        # SQL editor (shared, imported by the sql plugin's viewer)
│   ├── api.ts              # Typed window.api wrapper
│   └── e2e/                # Playwright specs
├── shared/                 # Code shared by main + renderer
│   ├── types.ts            # Kind enum, Request/Response/History types (imported as @/types.ts)
│   └── option.ts, result.ts, jq.ts
├── scripts/                # build.ts, ci.ts
└── docs/dev/               # Developer documentation
```

## Key Modules

### Backend: Plugin Modules (`main/database/`)

**Contract**: each plugin is a module exporting a `send<Kind>(data)` function plus an `*EmptyRequest` (or default) template.

`main/api.ts` routes kinds:
- `emptyRequestForKind(kind)` returns the default data used by `Create`
- `Perform(id)` dispatches to the plugin's `send<Kind>`, then `createResponse` persists the exchange into the entry's response history
- Source/tool kinds are exposed through dedicated sub-APIs instead of `Perform`: `api.GRPC`, `api.SQLSource`, `api.HTTPSource`, `api.MCP`

**Plugins**:
| Kind       | File           | Executed by                | Response history |
|------------|----------------|----------------------------|------------------|
| HTTP       | http.ts        | `Perform` -> `sendHTTP`    | Yes              |
| SQL        | sql.ts         | `Perform` -> `sendSQL`     | Yes              |
| GRPC       | grpc.ts        | `Perform` -> `sendGRPC`    | Yes              |
| JQ         | jq.ts          | `Perform` -> `sendJQ`      | Yes              |
| Redis      | redis.ts       | `Perform` -> `sendRedis`   | Yes              |
| MD         | md.ts          | `Perform` -> `sendMD`      | Yes              |
| DIFF       | diff.ts        | `Perform` -> `sendDIFF`    | Yes              |
| SQLSource  | sql_source.ts  | `api.SQLSource.*`          | No (on demand)   |
| HTTPSource | http_source.ts | `api.HTTPSource.*`         | No (on demand)   |
| MCP        | mcp.ts         | `api.MCP.*`                | No (on demand)   |

Kind identifiers are defined by the `Kind` enum in `shared/types.ts`; request data shapes are members of the `RequestData` union in the same file.

### Frontend: Request UI Modules

**Files**: one `viewer.ts` per kind inside `renderer/plugins/<kind>/` (the former `renderer/Request<Kind>.ts` files); kind-specific viewer components colocate in the plugin dir (e.g. `plugins/mcp/tool.ts`), shared ones stay in `renderer/components/` (`TableView.ts`, `EndpointViewer.ts`)

Each module follows the same factory interface:
```typescript
function Request<Kind>(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {update, send},
): {loaded, push_history_entry, unmount}
```

**Pattern**: These are intentionally separate files despite similar structure. They differ in:
- Request form rendering
- Response display (table for SQL, text for HTTP, etc.)

The deletion test: these are pass-throughs but that's OK - they're UI adapters, not shallow logic.

`panelkaFactory` in `renderer/App.ts` dispatches kind -> module via the plugin registry's `frame` hooks and is registered as the layout component factory for request panes. Source panes get their viewer components (shared ones from `renderer/components/`, kind-specific ones colocated in the plugin dir) from the plugin registry's `viewers` lists, which `App.ts` turns into layout factories.

### Frontend: Sidebar + Source Items

- `renderer/Sidebar.ts` - sidebar shell
- `renderer/sidebar/tree.ts` - tree rendering of request paths (persists expanded keys via `lib/localStorage.ts`); renders generic rows (root-item badge via the facade's `sourceBadge` + loading pulse for requests, baked tag/label for source items) and delegates all source data to the `renderer/plugins/source.ts` facade
- `renderer/sidebar/contextMenu.ts`, `shared.ts` (pure view modules; menu entries come from the plugin registry, "Refresh" from the facade's `sourceRefreshable`/`sourceRefresh`)

### Frontend: Plugins (`renderer/plugins/`)

Every request kind is also a frontend plugin. The registry drives everything that is "data about a kind" in the sidebar, context menu and command palette:

- `renderer/plugins/cache.ts` - shared engine, no registry/store imports: `createSourceCache<Entry>({fetcher, errorTitle})` (flat `Entry[]` cache with a staleness window `STALE_AFTER`, a `changed` version signal, `fetch`/`ensureFresh`/`invalidate`/`seed`/`get`) plus `listChildren` (listing-thunk body: serves current entries as `Item`s, fetches fire-and-forget when stale) and `isStale`
- `renderer/plugins/source.ts` - the source-item seam in one module, and the single one the sidebar consumes. Item side: the `Item` node type, the virtual-key codec (`composeVirtualKey`/`parseVirtualKey` with `:` escaping, so item keys like HTTP `GET /user/:id` round-trip), materialization of a root `Item` into `TreeOption`s gated by the expanded-key set (collapsed folders are never fetched; empty listings become disabled "Loading..."/"(None)" placeholders; "/"-containing item keys nest into virtual folder chains), and click resolution (`resolveIn`). Facade side: `sourceBadge(id)` (the kind badge, carried by the kind's root item), `sourceChildren(id, expanded)`, `sourceResolve(sourceID, segments)`, `sourceRefreshable`/`sourceRefresh`/`sourceIsLoading`, resolving the kind's `Plugin.root(id)` via the registry and store
- `renderer/plugins/index.ts` - explicit central registry: `plugins` array (one `Plugin` per kind) and the `pluginsByKind` map
- `renderer/plugins/<kind>/index.ts` - one module per kind: always `{kind, frame, root}` (`frame` mounts the kind's `viewer.ts` UI factory into a pane; source kinds hide the eye there and pass only `update`; `root(id): RootItem` returns the kind's invisible root carrying the kind badge — the facade renders it on sidebar request rows and the command palette; kinds with sidebar source listings give the root pure-factory `children` thunks serving items from kind-private caches (fire staleness-guarded fetches; MCP eagerly fetches all three listings on row expansion, tools/prompts/resources in three separate caches fed by one deduped IPC call), other kinds a badge-only root); optionally `menuEntries` (context-menu entries, e.g. "Copy as curl") and `viewers` (`{componentType, factory}` lists for item viewer panes, deduped and titled via `store.openViewer`). The dir holds the registration plus the kind's UI: `viewer.ts` (the frame factory), optionally extra viewer components (e.g. `mcp/tool.ts`, `mcp/resource.ts`), kind-private source caches (e.g. `mcp/source.ts`) and colocated tests

Adding a new kind means adding one `renderer/plugins/<kind>/` (an `index.ts` with the `Plugin` object plus a `viewer.ts` UI factory) and registering it in `renderer/plugins/index.ts`; no `switch (kind)` edits anywhere else.

### Frontend: Store

**File**: `renderer/store.ts`

Handles:
- Request state (`requests`, `requests2`)
- Layout state (`layoutConfig` (zod-validated, persisted), `activeComponentID`, tab navigation)

All backend access goes through `renderer/api.ts` -> `window.api`.

### Frontend: App

**File**: `renderer/App.ts`

Handles:
- Main layout mount
- Command palette
- Keyboard shortcuts
- Modal dialogs (create, rename)
- `panelkaFactory` (kind -> plugin.frame dispatch)

### Frontend: LocalStorage

**Extracted module**: `renderer/lib/localStorage.ts`

Provides clean interface:
```typescript
useLocalStorage<T>(key: string, init: T): {get value(), set value()}
```

Used by the sidebar tree for persisting expanded keys and by the store.

### Electron IPC (`main.ts` + `preload.ts` + `global.d.ts`)

- `main.ts`: one `ipcMain.handle()` per channel - entry CRUD (`List`, `Get`, `Create`, `Duplicate`, `Read`, `Rename`, `Update`, `Delete`), `Perform`, and namespaced source channels (`GRPC.*`, `SQLSource.*`, `HTTPSource.*`, `MCP.*`)
- `preload.ts`: `contextBridge.exposeInMainWorld("api", api)` mirrors every channel (plus `versions`)
- `global.d.ts`: the `Api` interface - the single source of truth for the IPC surface

## Data Flow

User -> renderer state (store/signals) -> `window.api` (IPC invoke) -> `main.ts` handler -> `main/api.ts` -> plugin `send*` -> response -> `createResponse` history in `db.json` -> renderer DOM update.

## Seams

| Seam | What varies | Adapters |
|------|-----------|----------|
| Plugin module (`main/database/`) | Request kind | 10 plugin files |
| Request UI (`renderer/plugins/<kind>/viewer.ts`) | Display format | 10 viewer modules |
| IPC surface (`global.d.ts` `Api`) | main ↔ renderer contract | `window.api` (preload) |
| Plugin registry (`renderer/plugins/`) | Kind-specific sidebar/menu metadata | 10 plugin files + `index.ts` registry |

## Testing Strategy

- **Backend**: Unit tests per plugin (`main/database/*_test.ts`), plus `main/api.test.ts` and `main/db.test.ts` (`bun run test`)
- **Frontend**: Component tests (`renderer/plugins/*/viewer.test.ts`, `renderer/plugins/cache.test.ts`, `renderer/components/*`, `renderer/lib/*`) (`bun run test`)
- **Go wasm engine**: Go tests of `internal/redissql/wasm` via `bun run test:go`, part of `bun run test` (runs under `GOOS=js GOARCH=wasm` via go's wasm exec wrapper; skipped when go is absent)
- **Integration**: `main/integration.test.ts` via `bun run test:integration` (`INTEGRATION=1`)
- **E2E**: Playwright (`renderer/e2e/`) via `bun run test:e2e` (builds first)

Tests cross at the interface, not past it.

## Adding New Plugins

1. `shared/types.ts`: add a `Kind` value and a `RequestData` member.
2. `main/database/<kind>.ts`: implement `send<Kind>` + `*EmptyRequest`, add a unit test.
3. `main/api.ts`: add a case in `emptyRequestForKind`, dispatch in `Perform` (performable kinds) or a dedicated sub-API (source kinds).
4. `main.ts` + `preload.ts` + `global.d.ts`: expose new channels through the typed IPC surface.
5. `renderer/plugins/<kind>/viewer.ts`: UI factory.
6. `renderer/plugins/<kind>/index.ts`: `{kind, frame, root}` (root returns the invisible `RootItem` carrying the kind badge) plus any `menuEntries` / `viewers` hooks; register the plugin in `renderer/plugins/index.ts` (kind badge, context-menu entries, source listings, pane factories and viewer panes then come from the registry - no further `switch (kind)` edits). Source listings give the root `children` serving `Item` nodes from a kind-private `createSourceCache`; sidebar projection, virtual keys, placeholders and click resolution come from the facade (`renderer/plugins/source.ts`).

## Architecture Decisions (ADRs)

- **Plugin per request type**: Each request kind is a separate backend module (`main/database/`) and a separate frontend plugin directory (`renderer/plugins/<kind>/`, `index.ts` + `viewer.ts`). Adding a new kind touches both sides plus the typed IPC surface.
- **All performable kinds persist response history**: `Perform` calls `createResponse` for every dispatched kind (including MD and DIFF).
- **Source kinds are queried on demand**: SQLSource/HTTPSource/MCP have dedicated IPC endpoints instead of `Perform`; listings are cached client-side through a generic `createSourceCache` engine in `renderer/plugins/cache.ts`, one private cache (or three, for MCP's tools/prompts/resources) per source kind. The sidebar never sees the caches: it consumes the `renderer/plugins/source.ts` facade over each kind's `root(id): Item` tree, materialized lazily along expanded paths.
- **Backend connections are pooled process-wide**: `main/database/connection_pool.ts` provides a `createClientPool` engine (generic over the client and key types) that caches clients by connection config, dedupes concurrent connects and closes clients idle for more than 5 minutes (`DEFAULT_TTL`); broken connections evict themselves (death events and per-operation errors), so the next request reconnects. `main/database/mcp.ts` keys it by the canonical MCP connection config (`connectionKey`: transport + command/args/env or url/headers); `redis.ts` by the normalized DSN URL; the SQL backends by DSN (postgres normalized + libpq-compat flag, sqlite plus its readonly flag). Transactional SQL batches (`sendBatch` in sql.postgres.ts / sql.mysql.ts) deliberately keep dedicated connections so concurrent batches cannot interleave inside one transaction.
- **Frontend plugin registry**: kind-specific sidebar/context-menu/command-palette data (badges, menu entries, source item rendering, staleness caching) lives in `renderer/plugins/` as an explicit registry instead of scattered `switch (kind)` statements.
- **Custom layout manager**: `renderer/layout/` implements panes/stacks/tabs/splitters directly instead of depending on a layout library.
- **Typed IPC contract**: the `Api` interface in `global.d.ts` is the single seam between preload and renderer.
- **LocalStorage at seam**: Extracted to `renderer/lib/localStorage.ts` for testability.

## Known Complexity

1. **`main/api.ts` dispatch**: every new kind touches `emptyRequestForKind` and `Perform` (or adds a sub-API namespace) - a deliberate, explicit switch
2. **Database migration** (`main/db.ts`): v1 -> current format handling is concentrated in one module
3. **10 structurally similar viewer modules** (`renderer/plugins/<kind>/viewer.ts`) - intentional separation, not duplication to collapse

## Vocabulary

- **Module**: Any code with interface + implementation (function, class, file)
- **Interface**: Everything a caller must know (types, invariants, error modes)
- **Seam**: Where interface lives; where behaviour can vary
- **Adapter**: Concrete thing satisfying interface at seam
- **Depth**: Leverage at interface (lots of behavior behind small surface)
