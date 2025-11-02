# AGENTS.md

## Purpose
This document provides a technical and structural overview of the `apiary` project, empowering AI coding agents with predictable, up-to-date information about the codebase and architectural patterns. Use this for high-level code navigation, understanding main flows and extensibility points, and for quickly orienting automation or refactoring agents. It complements the human-focused `README.md` by focusing on agent-specific details like setup, extensibility, and key flows.

## Project Overview
`apiary` is a cross-platform desktop application and interactive workspace for creating, executing, managing, and organizing API requests of various kinds, e.g., HTTP, SQL, gRPC, Redis, JQ, Markdown, and others. It is implemented as a desktop application using Go for the backend and Wails/TypeScript for the desktop app. The frontend uses vanilla TypeScript without frameworks.

- **Primary Technologies:** Go, TypeScript, Wails, GoldenLayout, CodeMirror.
- **Major Directories:**
  - `cmd/`: Helper executables for testing, e.g., example ClickHouse client, HTTP and gRPC servers.
  - `internal/app/`: Core backend logic including application struct and initialization.
  - `internal/database/`: All DB logic, the extensible "request/response kind" plugin mechanism, pure-model types.
  - `frontend/`: TypeScript front-end, main UI application and custom components.
  - `build/`: Platform-specific build outputs.

## Setup Commands
To set up and run the development environment:

- Install dependencies and run the app in dev mode:
  ```bash
  wails dev
  ```
  This starts the desktop app and exposes the frontend at http://localhost:34115/ for browser access.

- Use the process manager configuration (`pm.jsonnet`) to run or stop the app:
  ```bash
  pm run --config pm.jsonnet
  ```
  ```bash
  pm stop --config pm.jsonnet
  ```

- Spin up example databases for testing (e.g., MySQL, Redis) using Docker:
  ```bash
  docker-compose up
  ```
  Refer to `docker-compose.yaml` for details on the services.

## Build and Test Commands
- Build the application for your platform:
  ```bash
  wails build
  ```
  Outputs are placed in `build/`. For platform-specific instructions, see `build/README.md`.

- No explicit test commands are defined in the core setup; add unit tests in Go (`internal/`) and TypeScript (`frontend/src/`) as needed using standard tools like `go test` or `vitest` (if integrated).

## Code Style
- **Go:** Follow standard Go idioms; use `zerolog` for logging. Prefer context-based cancellation and modular plugin structures.
- **TypeScript:** Vanilla TypeScript with strict mode enabled. Use single quotes, functional patterns where possible. No frameworks; rely on native DOM APIs and libraries like GoldenLayout and CodeMirror.
- General: Keep code modular, with clear separation between backend (Go) and frontend (TypeScript). Run linters before committing (e.g., `go vet`, `tsc --noEmit`).

## Testing Instructions
- Run Go tests in backend modules:
  ```bash
  go test ./internal/...
  ```
- For frontend, if tests are added, use:
  ```bash
  npm test  # Assuming npm scripts in package.json; integrate vitest or jest if needed.
  ```
- Always add or update tests for new plugins or features. Linting:
  ```bash
  go vet ./...
  ```
  ```bash
  tsc --noEmit  # Type checking
  ```
- CI plans: Not specified; assume standard GitHub Actions or similar for PR validation.

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

## PR Instructions
- Use descriptive titles (e.g., "feat: add new SQL kind plugin").
- Run lint, tests, and build before submitting.
- Include updates to `AGENTS.md` for any structural changes.

## References
- For user/external contributor instructions, see `README.md` and docs in the repo root and `build/README.md`.
- Update this file with any structural, architectural, or cross-cutting changes that may affect code agents or automation tools.
