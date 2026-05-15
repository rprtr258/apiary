# Plan: Port Go Backend to TypeScript

## Context

The app was originally built with a **Wails** (Go + TypeScript) architecture. The Go backend lived in `internal/app/` and `internal/database/`, exposing ~22 methods to the frontend via Wails bindings (see `frontend/wailsjs/go/app/App.d.ts`).

The rewrite to **Electron** + TypeScript has started:
- `main.ts` — Electron main process with IPC handlers (only 2 registered: `list-requests`, `get-request`)
- `preload.ts` — Context bridge exposing IPC to renderer
- `root api.ts` — `List()` and `Get()` already ported
- `db.ts` — Database load logic only (`load()`)

**The Go backend code (`internal/app/handlers.go`) has been entirely commented out and pasted into `internal/app/handlers.ts`**, serving as a reference for what needs to be ported.

The remaining ~20 methods, plus the database write layer, still need to be ported. The frontend `api.ts` already attempts to call them (all currently fail, crashing IPC).

## Goal

Port all Go backend functionality to TypeScript so the Electron app works end-to-end: create, open, edit, execute, and save all request types (HTTP, SQL, GRPC, JQ, MD, Redis, DIFF, SQLSource, HTTPSource).

## Approach

### Database Layer (`db.ts`) — Core CRUD

The current `db.ts` only has `load()` (read db.json). We need write operations:

| Operation | Description |
|---|---|
| `save(DB)` | Atomic write of in-memory DB to `db.json` |
| `generateID()` | Unique ID generation (replaces Go nanoid) |
| `create(kind, path, data)` | Insert new request with generated ID |
| `delete(id)` | Remove request and all its data |
| `rename(id, newName)` | Update request path |
| `update(id, kind, data)` | Overwrite request data |
| `createResponse(id, response)` | Append response to request history |

The `Response` struct in Go has `{sent_at, received_at, response}` and the db.json stores it under key `data` (serialization quirk). Port correctly.

### IPC Handlers (`main.ts`) — Register all routes

Currently only 2 IPC handlers. Register handlers for all 22 API methods. Pattern:

```typescript
ipcMain.handle("operation-name", (_, ...args) => operation(args));
```

Each handler:
1. Loads db
2. Calls the appropriate database/execution function
3. Returns serialized result

### Request Execution — Per-kind Perform logic

These are the "Send" operations that actually execute requests:

| Kind | Go file | What to Port | Difficulty |
|---|---|---|---|
| **HTTP** | `plugin_http.go` | `http.NewRequest` → `fetch()`, header conversion, response parsing | Easy |
| **SQL** | `plugin_sql.go` | Database drivers for postgres, mysql, sqlite, clickhouse | Hard |
| **JQ** | `send_jq.go` | `gojq` → `jq-wasm` | Medium |
| **MD** | `plugin_md.go` | `goldmark` rendering + HTML sanitization → `marked` + `DOMPurify` | Medium |
| **Redis** | `plugin_redis.go` | `go-redis` → `@redis/client` | Medium |
| **GRPC** | `plugin_grpc.go` | `grpcurl` → `@grpc/grpc-js` + reflection | Hard |
| **DIFF** | `plugin_diff.go` | JSON diff algorithm → pure TS reimplementation | Medium |
| **SQL Source** | `plugin_sql_source.go` | ListTables, DescribeTable, CountRows → SQL introspection queries | Hard |
| **HTTP Source** | `plugin_http_source.go` | OpenAPI spec parsing (v2+v3) via `openapi-types`, example generation, endpoint listing | Hard |

All execution happens in the **main process** (Node.js) where we have access to `fetch`, `child_process`, `fs`, etc.

### Request Execution — General flow (ported from `handlers.go` `Perform`)

```typescript
function now(): Date { return new Date(); }

async function performRequest(id: string): Promise<HistoryEntry> {
  const db = load();
  const kind = db.request.find(r => r.id === id).kind;
  const entry = db[kind][id];
  const sentAt = now();
  const response = await execute(kind, entry.request);  // dispatches to per-kind executor
  const receivedAt = now();
  db[kind][id].responses.push({ sent_at: sentAt, received_at: receivedAt, data: response });
  await save(db);
  return { sent_at: sentAt, received_at: receivedAt, kind, request: entry.request, response };
}
```

### TypeScript API Surface (`main.ts` handlers → `root api.ts` functions)

| Go method | IPC channel | Status |
|---|---|---|
| `List()` | `list-requests` | ✅ Done in `api.ts:List` |
| `Get(id)` | `get-request` | ✅ Done in `api.ts:Get` |
| `Create(path, kind)` | `create-request` | ❌ |
| `Duplicate(id)` | `duplicate-request` | ❌ |
| `Read(id)` | `read-request` | ❌ (optional — `Get` already returns full data) |
| `Rename(id, newName)` | `rename-request` | ❌ |
| `Update(id, kind, data)` | `update-request` | ❌ |
| `Delete(id)` | `delete-request` | ❌ |
| `Perform(id)` | `perform-request` | ❌ |
| `JQ(json, query)` | `jq` | ❌ |
| `GRPCMethods(target)` | `grpc-methods` | ❌ |
| `GRPCQueryFake(target, method)` | `grpc-query-fake` | ❌ |
| `GRPCQueryValidate(target, method, payload)` | `grpc-query-validate` | ❌ |
| `PerformSQLSource(id, query)` | `perform-sql-source` | ❌ |
| `TestSQLSource(id)` | `test-sql-source` | ❌ |
| `ListTablesSQLSource(id)` | `list-tables-sql-source` | ❌ |
| `DescribeTableSQLSource(id, table)` | `describe-table-sql-source` | ❌ |
| `CountRowsSQLSource(id, table)` | `count-rows-sql-source` | ❌ |
| `ListEndpointsHTTPSource(id)` | `list-endpoints-http-source` | ❌ |
| `GenerateExampleRequestHTTPSource(id, idx)` | `generate-example-http-source` | ❌ |
| `PerformVirtualEndpointHTTPSource(id, idx, req)` | `perform-virtual-endpoint` | ❌ |
| `TestHTTPSource(id)` | `test-http-source` | ❌ |
| `FetchSpecHTTPSource(id)` | `fetch-spec-http-source` | ❌ |

## Files to modify

| File | Role |
|---|---|
| `db.ts` | Database CRUD (add write operations) |
| `api.ts` (root) | All handler functions (add ~20 functions) |
| `main.ts` | Register IPC handlers for new functions |
| `preload.ts` | Expose new IPC channels (just type annotations) |
| `frontend/api.ts` | Uncomment/restore frontend API calls (most already defined, just need working IPC) |
| `frontend/store.ts` | Minor: handle new response shapes if changed |

### New files — Per-kind modules (mirror `internal/database/plugin_*.go`)

Create `database/` directory alongside `db.ts` with one file per kind:
- `database/http.ts` — HTTP request execution
- `database/sql.ts` — SQL request execution
- `database/jq.ts` — JQ execution (via `jq-wasm`)
- `database/md.ts` — Markdown rendering
- `database/redis.ts` — Redis execution
- `database/grpc.ts` — GRPC execution
- `database/diff.ts` — JSON diff
- `database/sql_source.ts` — SQL source operations (ListTables, DescribeTable, CountRows)
- `database/http_source.ts` — HTTP source operations (ParseSpec, GenerateExample, etc.)
- `database/index.ts` — Re-export all with a `Plugins` registry matching Go's pattern

## Reuse: existing code to leverage

- **`db.ts`**: `load()`, `RequestID`, `extractSubKind()` — keep and extend
- **`root api.ts`**: `List()`, `Get()` — keep as reference pattern
- **`internal/app/handlers.ts`**: Full commented-out Go code converted to comments — the porting blueprint. Every function signature and logic is documented there.
- **`frontend/api.ts`**: All API call wrappers defined but commented out — just uncomment and wire to IPC
- **`frontend/wailsjs/go/models.ts`**: Type definitions (already accurate) — keep as-is
- **`internal/database/*.go`**: Each plugin file has the full implementation — the porting source

### npm dependencies to add

| Package | Purpose |
|---|---|
| `nanoid` | Unique ID generation |
| `jq-wasm` | JQ query execution |
| `marked` | Markdown → HTML |
| `DOMPurify` | HTML sanitization |
| `@redis/client` | Redis client |
| `@grpc/grpc-js` + `protobufjs` | GRPC client + reflection |
| `pg` | PostgreSQL driver |
| `mysql2` | MySQL driver |
| `better-sqlite3` | SQLite driver |
| `@clickhouse/client` | ClickHouse driver |
| `openapi-types` | OpenAPI spec types |
## Steps (implementation order)

### Phase 1: Database Layer (foundation)

- [ ] **Step 1**: Add `save(db)` to `db.ts` — atomic write to `db.json`, use `$version: 1`
- [ ] **Step 2**: Add `generateID()` using `nanoid` library
- [ ] **Step 3**: Add `create(kind, path, data)`, `delete(id)`, `rename(id, newName)`, `update(id, kind, data)`, `createResponse(id, response)` to `db.ts`
- [ ] **Step 4**: Write unit tests for all CRUD operations

### Phase 2: IPC Plumbing

- [ ] **Step 5**: In `main.ts`, register IPC handlers for every API method (create, delete, rename, update, perform, etc.) — initially just return mock data
- [ ] **Step 6**: In `preload.ts`, expose new IPC methods (currently commented out)
- [ ] **Step 7**: In `frontend/api.ts`, uncomment the `App.xxx` wrappers so they point to the new IPC channels

### Phase 3: Simple Operations (no external deps)

- [ ] **Step 8**: Port `Create`, `Duplicate`, `Read`, `Rename`, `Update`, `Delete` → these only touch `db.ts`, no external services
- [ ] **Step 9**: Write unit tests for all CRUD operations

### Phase 4: HTTP Execution

- [ ] **Step 10**: Port `plugin_http.go` → `database/http.ts` using Node.js `fetch()`, header conversion, response body/headers parsing
- [ ] **Step 11**: Wire through `Perform` → `execute("http", requestData)`
- [ ] **Step 12**: Write unit tests for HTTP execution (mock fetch)

### Phase 5: JQ Execution

- [ ] **Step 13**: Port `send_jq.go` → `database/jq.ts` using `jq-wasm`
- [ ] **Step 14**: Write unit tests for JQ execution

### Phase 6: MD Rendering

- [ ] **Step 15**: Port `plugin_md.go` → `database/md.ts` using `marked` + `DOMPurify`
- [ ] **Step 16**: Write unit tests for MD rendering

### Phase 7: SQL Execution

- [ ] **Step 17**: Port `plugin_sql.go` → `database/sql.ts` with per-DB drivers (`pg`, `mysql2`, `better-sqlite3`, `@clickhouse/client`)
- [ ] **Step 18**: Port `plugin_sql_source.go` → `database/sql_source.ts` — ListTables, DescribeTable, CountRows via SQL introspection queries
- [ ] **Step 19**: Port `TestSQLSource` — ping DB to verify connection
- [ ] **Step 20**: Write unit tests for SQL execution (use services from `docker-compose.yml`)

### Phase 8: Redis Execution

- [ ] **Step 21**: Port `plugin_redis.go` → `database/redis.ts` using `@redis/client`
- [ ] **Step 22**: Write unit tests for Redis execution

### Phase 9: HTTP Source (OpenAPI)

- [ ] **Step 23**: Port `plugin_http_source.go` → `database/http_source.ts` — ParseSpec (OpenAPI v2/v3 via `openapi-types`), FetchSpec (URL or file)
- [ ] **Step 24**: Port `GenerateExampleRequest` — generate example request bodies from schemas
- [ ] **Step 25**: Port `PerformVirtualEndpointHTTPSource` — generate + merge + execute HTTP request
- [ ] **Step 26**: Port `TestHTTPSource`, `FetchSpecHTTPSource`
- [ ] **Step 27**: Write unit tests for OpenAPI spec parsing and example generation

### Phase 10: GRPC Execution

- [ ] **Step 28**: Port `plugin_grpc.go` → `database/grpc.ts` using `@grpc/grpc-js` + `protobufjs` for reflection, service discovery, method invocation
- [ ] **Step 29**: Port `GRPCMethods`, `GRPCQueryFake` (generate fake request from proto schema)
- [ ] **Step 30**: Port `GRPCQueryValidate` (proto schema validation)
- [ ] **Step 31**: Write unit tests for GRPC client (use services from `docker-compose.yml`)

### Phase 11: DIFF

- [ ] **Step 32**: Port `plugin_diff.go` → `database/diff.ts` — reimplement `sendDIFF`, JSON diff algorithm, stats calculation in pure TS
- [ ] **Step 33**: Write unit tests for DIFF logic

## Verification

After each phase:
1. **`bun run test`** — all unit tests pass (including new tests for that phase)
2. **`tsc --noEmit`** — no new type errors
3. **`bun run build`** — frontend + electron build succeeds
4. **`bun run lint`** — no new lint errors
5. **Manual** — Open an HTTP request tab, verify data loads. Click Send, verify response shows.
6. For SQL/Redis/GRPC phases, use services from `docker-compose.yml`

## Edge cases to handle

- **db.json doesn't exist** → create with `$version: 1` and empty data
- **Disk full/write error** → catch and surface via Result type
- **Concurrent save** → serialize writes (single-threaded Node.js main process handles this)
- **Response `data` vs `response` field** — db.json uses `data`, Go `Response.Response` maps to it. The frontend expects `response` in `HistoryEntry`. Need to map correctly.