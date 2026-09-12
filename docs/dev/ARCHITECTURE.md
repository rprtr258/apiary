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
│       └── sql_source.ts, http_source.ts, mcp.ts
├── renderer/               # Frontend (vanilla TypeScript, no framework)
│   ├── App.ts              # Layout mount, command palette, keyboard shortcuts, panelkaFactory
│   ├── store.ts            # Central state (requests, layoutConfig, activeComponentID)
│   ├── Sidebar.ts          # Sidebar shell
│   ├── sidebar/            # tree.ts, contextMenu.ts, sourceCache.ts, shared.ts
│   ├── layout/             # Custom layout manager (panes/stacks/tabs/splitters)
│   ├── components/         # Reusable N* components (CommandPalette, TableView, ViewJSON, ...)
│   ├── lib/                # utils.ts (signal, m), styles.ts (css/css.raw), localStorage.ts, notification.ts
│   ├── Request*.ts         # UI module per request kind (10 files) + EditorSQL.ts
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

**Files**: `RequestHTTP.ts`, `RequestSQL.ts`, ..., `RequestMCP.ts` (10 files)

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

`panelkaFactory` in `renderer/App.ts` dispatches kind -> module via a switch and is registered as the layout component factory for request panes. Source panes register dedicated viewer components (`TableView.ts`, `EndpointViewer.ts`, `MCPToolViewer.ts`).

### Frontend: Sidebar + Source Cache

- `renderer/Sidebar.ts` - sidebar shell
- `renderer/sidebar/tree.ts` - tree rendering of request paths (persists expanded keys via `lib/localStorage.ts`)
- `renderer/sidebar/sourceCache.ts` - `tableCache` / `endpointCache` / `toolCache` with a staleness window and a version signal subscribers re-render on
- `renderer/sidebar/contextMenu.ts`, `shared.ts`

### Frontend: Store

**File**: `renderer/store.ts`

Handles:
- Request state (`requests`, `requests2`)
- Layout state (`layoutConfig` (zod-validated, persisted), `activeComponentID`, tab navigation)
- Exports `updateLocalstorage()`, `handleCloseTab(id)`, `last_history_entry(request)`

All backend access goes through `renderer/api.ts` -> `window.api`.

### Frontend: App

**File**: `renderer/App.ts`

Handles:
- Main layout mount
- Command palette
- Keyboard shortcuts
- Modal dialogs (create, rename)
- `panelkaFactory` (kind -> UI module dispatch)

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
| Request UI (`renderer/Request*.ts`) | Display format | 10 UI modules |
| IPC surface (`global.d.ts` `Api`) | main ↔ renderer contract | `window.api` (preload) |
| sourceCache | Freshness of source metadata | table / endpoint / tool caches |

## Testing Strategy

- **Backend**: Unit tests per plugin (`main/database/*_test.ts`), plus `main/api.test.ts` and `main/db.test.ts` (`bun run test`)
- **Frontend**: Component tests (`renderer/Request*.test.ts`, `renderer/components/*`, `renderer/lib/*`) (`bun run test`)
- **Integration**: `main/integration.test.ts` via `bun run test:integration` (`INTEGRATION=1`)
- **E2E**: Playwright (`renderer/e2e/`) via `bun run test:e2e` (builds first)

Tests cross at the interface, not past it.

## Adding New Plugins

1. `shared/types.ts`: add a `Kind` value and a `RequestData` member.
2. `main/database/<kind>.ts`: implement `send<Kind>` + `*EmptyRequest`, add a unit test.
3. `main/api.ts`: add a case in `emptyRequestForKind`, dispatch in `Perform` (performable kinds) or a dedicated sub-API (source kinds).
4. `main.ts` + `preload.ts` + `global.d.ts`: expose new channels through the typed IPC surface.
5. `renderer/Request<Kind>.ts`: UI factory; register it in the `panelkaFactory` switch in `renderer/App.ts`.

## Architecture Decisions (ADRs)

- **Plugin per request type**: Each request kind is a separate backend module (`main/database/`) and a separate UI module (`renderer/Request*.ts`). Adding a new kind touches both sides plus the typed IPC surface.
- **All performable kinds persist response history**: `Perform` calls `createResponse` for every dispatched kind (including MD and DIFF).
- **Source kinds are queried on demand**: SQLSource/HTTPSource/MCP have dedicated IPC endpoints instead of `Perform`; results are cached client-side (`renderer/sidebar/sourceCache.ts`).
- **Custom layout manager**: `renderer/layout/` implements panes/stacks/tabs/splitters directly instead of depending on a layout library.
- **Typed IPC contract**: the `Api` interface in `global.d.ts` is the single seam between preload and renderer.
- **LocalStorage at seam**: Extracted to `renderer/lib/localStorage.ts` for testability.

## Known Complexity

1. **`main/api.ts` dispatch**: every new kind touches `emptyRequestForKind` and `Perform` (or adds a sub-API namespace) - a deliberate, explicit switch
2. **Database migration** (`main/db.ts`): v1 -> current format handling is concentrated in one module
3. **10 structurally similar Request UI modules** - intentional separation, not duplication to collapse

## Vocabulary

- **Module**: Any code with interface + implementation (function, class, file)
- **Interface**: Everything a caller must know (types, invariants, error modes)
- **Seam**: Where interface lives; where behaviour can vary
- **Adapter**: Concrete thing satisfying interface at seam
- **Depth**: Leverage at interface (lots of behavior behind small surface)