# Plugin Implementation Checklist

## Shared Types (`shared/types.ts`)

- [ ] Add `Kind<NAME> = "<name>"` to the `Kind` enum
- [ ] Add `<NAME>Request` and `<NAME>Response` types
- [ ] Add member to `RequestData` union: `| {kind: Kind.<NAME>} & <NAME>Request`
- [ ] If performable: add to `ResponseData` and `HistoryEntry` unions

## Backend (`main/database/`)

- [ ] Create `<name>.ts` with `EmptyRequest: <NAME>Request` constant and `send<NAME>(data: <NAME>Request): Promise<<NAME>Response>` (sync is fine for compute-only kinds)
- [ ] No Electron imports in the plugin module (keeps it unit-testable)
- [ ] Create `<name>.test.ts` with `bun:test`, mocking external dependencies via `mock.module`
- [ ] Exact equality assertions, not substring contains

## Dispatch (`main/api.ts`)

- [ ] Add case to `emptyRequestForKind(kind)` returning the empty request
- [ ] Performable kind: add case to `Perform(id)` calling `send<NAME>` (response history is persisted automatically via `createResponse`)
- [ ] Source kind: add a sub-API namespace instead (pattern: `export const GRPC` / `SQLSource` / `HTTPSource` / `MCP`)

## IPC Surface

- [ ] `main.ts`: one `ipcMain.handle("<Channel>", ...)` per new channel
- [ ] `preload.ts`: matching `ipcRenderer.invoke("<Channel>", ...)` entry in the `api: Api` object
- [ ] `global.d.ts`: matching entry in the `Api` interface

## Frontend (`renderer/`)

- [ ] Create `plugins/<name>/viewer.ts` — default export factory `(el, show_request, on: {update, send})` returning `{loaded, push_history_entry, unmount}`
- [ ] DOM with `m()` (`renderer/lib/utils.ts`), styles with `css`/`css.raw` (`renderer/lib/styles.ts`)
- [ ] `signal<T>()` only for watched state
- [ ] Errors rendered above main content
- [ ] Debounce rapid updates (500ms) if the kind auto-computes
- [ ] Clean up listeners/editors in `unmount()`
- [ ] Create `plugins/<name>/viewer.test.ts` (`bun:test` + `happy-dom`)

## Registration (`renderer/plugins/<name>/`)

- [ ] Wire the UI module into the plugin's `frame` hook:
  - Performable: `frame: (args) => Request<NAME>(args.el, args.show_request, args.on);`
  - Source: `frame: (args) => { setDisplay(args.eye, false); return Request<NAME>(args.el, {update: args.on.update}); }`
- [ ] Source panes with fetched data: ship the viewer component (shared ones in `renderer/components/`, kind-specific ones colocated in `plugins/<name>/`) and expose it via the plugin's `viewer` hook (no `App.ts` edit — factories come from the registry)

## Plugin (`renderer/plugins/`, every kind)

- [ ] Create `plugins/<name>/index.ts` exporting a `Plugin` (the UI factory lives in the sibling `viewer.ts`): `kind` + `frame` + `root` (invisible `RootItem` carrying the kind badge) for every kind; optional `menuEntries` for per-kind context-menu entries
- [ ] Source kinds: add `cache` (via `createSourceCache({fetcher, errorTitle})`), `itemKey`, `label`, `tag`, optional `onOpen` (called as `(id, item, itemKey)`, opens the pane via `store.openViewer`) and `childrenOf` (`(item) => Promise<Item[]>` for group items); add `viewer` (`{componentType, factory}`) when items have a viewer pane
- [ ] `itemKey`/`label`/`tag` are sync mappings over cached data — async work belongs to the fetcher
- [ ] Add one line to `plugins` in `renderer/plugins/index.ts`
- [ ] No edits in `renderer/sidebar/` — tree children, click handling, tags, the Refresh entry, and staleness are registry-driven

## Database (`main/db.ts`)

- [ ] No changes needed — the v1 migration switch only covers kinds that existed in v1 databases

## Post-Implementation

```bash
bun run test             # unit + component tests
bun run test:integration # INTEGRATION=1
bun run ci               # lint + typecheck
bun run build
bun run test:e2e         # Playwright (renderer/e2e/)
bun run dist             # package the app
```

- [ ] Create a new request of the new kind
- [ ] Perform it; response appears and lands in history
- [ ] Restart the app; request and history persist (`db.json`)

## Quick Reference

### Plugin Types
- **Performable kind**: dispatched in `Perform`, response persisted via `createResponse` (all current kinds: HTTP, SQL, GRPC, JQ, Redis, MD, DIFF)
- **Source kind**: no `Perform`; dedicated IPC sub-API queried on demand (SQLSource, HTTPSource, MCP); `RequestData` member only

### Key Decisions
1. **Performable or source?** Has a one-shot execute action → `Perform`. Exposes browsing/querying of an external system → sub-API namespace.
2. **Defaults**: provide sensible `EmptyRequest` — it's what users see on create
3. **Error display**: above main content

### Full Guide
See `docs/dev/ADDING_NEW_PLUGINS.md` for a step-by-step walkthrough with code examples.