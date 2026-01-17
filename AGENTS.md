# AGENTS.md

## General Guidelines
- Do not update code which does not relate to the change.
- Do not modify any code, spacing, indentation, line breaks, or formatting outside the specific changes requested.
- Only edit files and lines directly related to the task at hand.
- Do not complete additional tasks until explicitly asked.
- Do not run auto-formatting tools (like `lint:fix` or `format`) unless explicitly requested by the user.
- Use Chrome MCP to debug changes using dev server running on `http://localhost:34115/`.
- Do not ever run your own dev server or stop existing one.
- Run `bun run ci` and `bun run build` during and after completing functionality to ensure lint passes, typechecks succeed, and build completes without errors.
- Include updates to `AGENTS.md` for any structural, architectural, or cross-cutting changes.
- Use `bd-mcp` for creating and tracking complex task plans
- Follow effective and correct programming practices.
- Do not ever change config files like `eslint.config.ts` or `tsconfig.json`.

## Commands
- **Build**: `bun run build`
- **Lint**: `bun run lint`
- **Check**: `bun run ci`

## Project Overview
`apiary` is a cross-platform desktop application and interactive workspace for creating, executing, managing, and organizing API requests of various kinds, e.g., `HTTP`, `SQL`, `gRPC`, `Redis`, `JQ`, `Markdown`, and others. It is implemented as a desktop application using `Go` for the backend and `Wails`/`TypeScript` for the desktop app. The frontend uses vanilla `TypeScript` without frameworks.

- **Primary Technologies:** Go, TypeScript, Wails, GoldenLayout, CodeMirror.
- **Major Directories:**
  - `cmd/`: Helper executables for testing, e.g., example ClickHouse client, HTTP and gRPC servers.
  - `internal/app/`: Core backend logic including application struct and initialization.
  - `internal/database/`: All DB logic, the extensible "request/response kind" plugin mechanism, pure-model types.
  - `frontend/`: TypeScript front-end, main UI application and custom components.

## Setup Commands
To set up and run the development environment:
- Spin up example databases and servers for testing (e.g., `MySQL`, `Redis`) using `Docker`:
  ```bash
  docker-compose up
  ```
  Refer to `docker-compose.yaml` for details on the services.
- Stop example services:
  ```bash
  docker-compose down
  ```
- Build the application for your platform:
  ```bash
  wails build
  ```
  Outputs are placed in `build/`. For platform-specific instructions, see `build/README.md`.
- No explicit test commands are defined in the core setup; add unit tests in Go (`internal/`) and TypeScript (`frontend/src/`) as needed using standard tools like `go test` or `bun run ci`.
- Run Go tests in backend modules:
  ```bash
  go test ./internal/...
  ```

## Code Style
- **Go:** Follow standard Go idioms; use `zerolog` for logging. Prefer context-based cancellation and modular plugin structures.
- **TypeScript:** Vanilla TypeScript with strict mode enabled. Prefer immutability by using const instead of let and avoiding reassignment (i.e., prefer immutable variables and pure functions). Use single assignment, functional style where possible. Example: Use `const result = data.map(item => item.value)` instead of `let result = []; for (const item of data) { result.push(item.value); }`. No frameworks; rely on native DOM APIs and libraries like GoldenLayout and CodeMirror.
- General: Keep code modular, with clear separation between backend (Go) and frontend (TypeScript). Run linters before committing (e.g., `go vet`, `tsc --noEmit`).
- Do not modify or patch 3rd party dependencies, including overwriting their styles, or using `!important`.
- Do not ever use `overflow: hidden`, `Array.forEach`.
- Do not ever disable linter checks until user explicitly requests it.

## Key Architecture Points
### Backend (Go)
- **Entrypoint:** `main.go` initializes the Wails application, sets up the main context, loads the DB from `db.json`, migrates and flushes on startup, and injects backend objects as bindings for the UI.
- **Backend Modules:**
  - `internal/app/`: Defines the main `App` struct and creates core bindings for UI interaction.
  - `internal/database/`:
    - Central hub for **request/response types** and **plugin infrastructure**—each protocol or kind is a plugin (see `plugin.go`).
    - **Kinds supported:** HTTP, SQL (Postgres, MySQL, SQLite, ClickHouse), Redis, GRPC, JQ, Markdown, SQLSource, each with its struct type (e.g., `HTTPRequest`, `SQLRequest`...) and plugin performing business logic.
    - Database is backed by a versioned, JSON-file DB (`db.json`), encoded/decoded via custom logic.
    - Plugins register creation, update, execution, and response creation hooks for each kind.
    - New kinds can be added by extending the plugin map in `plugin.go` and implementing struct+logic files with the plugin contract.
- **Cross-cutting Support:** Uses `zerolog` for logging, context-based cancellation, and third-party Go libraries for DB/protocol access (see `go.mod`).

### Frontend - Vanilla TypeScript Architecture
**No frameworks** - pure DOM manipulation and custom reactivity.

#### Core Patterns

##### Reactive Signals (`utils.ts`)
```typescript
signal<T>(value: T): Signal<T>
```
- Manual pub/sub for UI state
- `update(fn)` to mutate, `sub(cb)` to react
- Used for show/hide, input values, layout state

##### DOM Builder (`utils.ts`)
```typescript
m(tag, props, ...children): HTMLElement
```
- JSX-like syntax without transpiler
- Returns real DOM elements
- Handles events (`onclick`, `oninput`), styles, attributes

##### Two Component Patterns

###### Pattern A: Element Creators (`components/input.ts`, `components/layout.ts`, `components/dataview.ts`)
```typescript
NInput(props): HTMLElement
NTabs(props): HTMLElement
NTree(props): HTMLElement
```
- Return DOM elements directly
- Self-contained, no external dependencies
- Used for building UI structure
- Examples: `NButton`, `NSelect`, `NModal`, `NTable`

###### Pattern B: Factory Functions (`RequestHTTP.ts`, `RequestSQL.ts`, `RequestGRPC.ts`, etc.)
```typescript
RequestHTTP(el, show_signal, {update, send})
```
- Receive container element + signals + handlers
- Return control interface (`loaded()`, `push_history_entry()`)
- Manage internal state and DOM mutations
- One factory per request kind (HTTP, SQL, GRPC, JQ, Redis, MD)

##### Central Store (`store.ts`)
```typescript
store = {
  requests, requests2, requestsTree,
  createRequest, duplicate, deleteRequest, rename,
  selectRequest, fetch, layout
}
```
- Manages request data, tree structure, tabs
- Coordinates with Wails backend
- Provides CRUD operations
- Optimistic updates

##### GoldenLayout Integration
- Tabbed multi-pane interface
- Component factory registration (`panelkaFactory`)
- localStorage persistence
- Dynamic tab creation

#### Data Flow
```
User → Signal → Store → Wails API → Store → DOM
```

#### Core Files
- `App.ts`: Main orchestrator, layout setup, modals, command palette
- `store.ts`: State management + backend coordination
- `api.ts`: Wails bindings wrapper + type definitions
- `utils.ts`: Signal reactivity + DOM builder
- `Request*.ts`: Per-kind UI component factories
- `components/`: Reusable element creators

#### Component Lifecycle
1. **Factory creation** → `panelkaFactory()` creates container
2. **Component init** → `RequestHTTP(el, signal, handlers)`
3. **Data load** → `get_request(id)` → `frame.loaded(r)`
4. **User interaction** → `on.update()` / `on.send()`
5. **History push** → `frame.push_history_entry(he)`

#### Extension Points
- **New Request Type**: Create `RequestNewKind.ts` + register in `App.ts:236-243`
- **New UI Component**: Follow factory pattern, use `m()` builder
- **New Backend API**: Add to `api.ts` + Go backend plugin

#### Key Files & Responsibilities
| File | Purpose |
|------|---------|
| `App.ts` | Main orchestrator, layout, modals, command palette |
| `store.ts` | State + backend coordination |
| `api.ts` | Wails bindings + types |
| `utils.ts` | Signal + DOM builder |
| `Request*.ts` | Per-kind UI component factories |
| `components/input.ts` | Form controls (Input, Select, Dropdown, Button) |
| `components/layout.ts` | Tabs, Modals, Scrollbars |
| `components/dataview.ts` | Tree, Table, List, Empty states |
| `components/editor.ts` | CodeMirror extensions/config |
| `components/icons.ts` | SVG icon components |

**Core Principle**: No frameworks, no VDOM - direct DOM manipulation with manual reactivity.

## Persistence/Database
- **File:** `db.json` (adjacent to app binary; JSON, versioned, custom encoded).
- **Schema:** Stores all requests, responses, and their hierarchical organization. Top-level object has tables like "requests", "responses", each containing flat lists of objects with consistent fields.
- **Migration:** Decoding logic supports backward compatibility; code migrates DB on startup.

## Extensibility/Integration Points
- **Plugins:** Add new request/response kinds by creating new plugin files in `internal/database/`, implementing the contract, and registering in `plugin.go`.
- **Frontend:** Bind new kinds into `frontend/src/api.ts`, `App.ts`, and provide UI components under `components/`/`Request<Type>.ts`.
- **IPC:** Go/Wails exposes Go methods/types via Wails, enabling reactivity/UI event bindings to backend.

## Notable Entities & Flows
- **App Lifecycle:**
  1. Loads `db.json` data (or initializes if not exists).
  2. Flushes (migrates) database to latest version.
  3. Exposes functionality (CRUD, execution, history) as Wails bindings.
  4. Frontend synchronizes requests tree and details from backend, calls perform/update/create/... as needed.
- **Request/Response Operations:** All operations on requests are routed through the plugin system, which provides standard interfaces for creation, updating, execution (perform), and response history.
- **UI Operations:** Sidebar tree for request management, GoldenLayout tabs/panes for multi-request viewing, modal dialog orchestration, command-palette for keyboard-centric navigation.

## Cross-Cutting Concerns
- All business logic is organized around the concept of **Kind plugins**.
- DB upgrade and JSON migrations are handled in backend and flushed immediately at startup.
- The code is designed to make it easy to add new APIs to both the backend and frontend—follow plugin registration and TypeScript extension patterns.
