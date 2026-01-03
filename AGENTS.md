# AGENTS.md

## General Guidelines
- Do not update code which does not relate to the change.
- Do not modify any code, spacing, indentation, line breaks, or formatting outside the specific changes requested.
- Only edit files and lines directly related to the task at hand.
- Do not complete additional tasks until explicitly asked.
- Do not run auto-formatting tools (like `lint:fix` or `format`) unless explicitly requested by the user.
- Use Chrome MCP to debug changes using dev server running on `http://localhost:34115/`.
- Do not ever run your own dev server or stop existing one.
- Run `bun run ci` during and after completing functionality to check for linter and type errors.
- Include updates to `AGENTS.md` for any structural, architectural, or cross-cutting changes.
- Use `bd-mcp` for creating and tracking complex task plans

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
- **TypeScript:** Vanilla TypeScript with strict mode enabled. Use single quotes, functional patterns where possible. No frameworks; rely on native DOM APIs and libraries like GoldenLayout and CodeMirror.
- General: Keep code modular, with clear separation between backend (Go) and frontend (TypeScript). Run linters before committing (e.g., `go vet`, `tsc --noEmit`).

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

### Frontend
- **Framework:** Vanilla TypeScript, GoldenLayout for multi-pane UI, and custom controls; packaged with Vite.
- **Core Files:**
  - `frontend/src/App.ts`: Main app orchestrator; handles UI structure, modals, command palette, request-management logic.
  - `frontend/src/store.ts`: Frontend store for requests, layout state, CRUD actions, and syncing with backend.
  - `frontend/src/api.ts`: API surface/types for requests to the backend via Wails bindings.
  - `frontend/src/components/`: UI widgets and controls.
- **Features:**
  - Interactive request/response panels for each supported kind.
  - Hierarchical sidebar for organizing requests (tree, drag-n-drop, rename, duplicate, delete).
  - History tracking per request, request execution and display, tabbed/multi-pane layout via GoldenLayout.
  - Command palette (modal) for quick actions: create/rename/duplicate/delete requests, navigation, etc.
  - Modal dialogs for request creation, renaming, managing confirmation, inputs.
  - Local storage for layout persistence, open tabs, unfolded directories in explorer sidebar.

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
