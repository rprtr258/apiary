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

- [ ] Create `Request<NAME>.ts` — default export factory `(el, show_request, on: {update, send})` returning `{loaded, push_history_entry, unmount}`
- [ ] DOM with `m()` (`renderer/lib/utils.ts`), styles with `css`/`css.raw` (`renderer/lib/styles.ts`)
- [ ] `signal<T>()` only for watched state
- [ ] Errors rendered above main content
- [ ] Debounce rapid updates (500ms) if the kind auto-computes
- [ ] Clean up listeners/editors in `unmount()`
- [ ] Create `Request<NAME>.test.ts` (`bun:test` + `happy-dom`)

## Registration (`renderer/App.ts`)

- [ ] Import the module (default export)
- [ ] Add case to `createFrame`:
  - Performable: `case t.Kind.<NAME>: return Request<NAME>(el, show_request, on);`
  - Source: `setDisplay(eye, false); return Request<NAME>(el, {update: on.update});`
- [ ] Source panes with fetched data: register a viewer component (pattern: `TableViewer` / `EndpointViewer` / `ToolViewer`)

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