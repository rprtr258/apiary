# AGENTS.md

## General Guidelines

- Never update code unrelated to the task.
- Never modify spacing, indentation, line breaks, or formatting outside specific changes.
- Only edit files and lines directly related to the task.
- Never complete additional tasks unless explicitly asked.
- Never run auto-formatting tools unless explicitly requested.
- Never change config files like `eslint.config.ts` or `tsconfig.json`.
- Never modify or patch 3rd-party dependencies, including overwriting styles or using `!important`.
- Never use `overflow: hidden`, `Array.forEach`.
- Never disable linter checks unless explicitly requested.
- Run `bun run ci` and `bun run build` (in frontend/) after any code changes to ensure linting, typechecking, and build succeed.
- Include updates to `AGENTS.md` for structural or architectural changes.
- Use context-based cancellation in Go code.
- Use zerolog for logging in Go.
- Maintain plugin architecture for request kinds.

## Commands

- **Lint and Typecheck**: `bun run ci` (run in frontend/)
- **Build Frontend**: `bun run build` (run in frontend/)
- **Build Desktop App**: `wails build`
- **Run Go Tests**: `go test ./internal/...`

## Project Overview

apiary is a cross-platform desktop application for managing API requests (HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource) using Go backend and vanilla TypeScript frontend via Wails.

- **Tech Stack**: Go, TypeScript, Wails, GoldenLayout, CodeMirror, JSON DB.
- **Directories**:
  - `cmd/`: Test executables.
  - `internal/app/`: Core backend app struct and bindings.
  - `internal/database/`: Plugin system, request/response types, JSON DB logic.
  - `frontend/`: Vanilla TypeScript UI components and logic.

## Code Style

- **Go**: Standard idioms, zerolog logging, context cancellation, plugin modularity.
- **TypeScript**: Strict mode, double quotes, const over let, prefer functional style (e.g., `data.map(item => item.value)`), no frameworks, direct DOM APIs.
- **General**: Modular code, backend/frontend separation, immutable variables, pure functions where possible.

## Architecture Patterns

- **Backend Plugins**: Each request kind (HTTP, SQL, etc.) has a plugin in `internal/database/` with `Perform`, `create`, `update`, `createResponse` functions, and Request/Response structs implementing `Kind()` and `MarshalJSON()`.
- **Frontend Factories**: Each request kind has a `Request*.ts` factory function taking `(el, signal, handlers)` and returning `{loaded, push_history_entry, unmount}`. See `frontend` skill for detailed frontend engineering guidelines.
- **Reactivity**: Use `signal<T>()` for state, `m()` for DOM building, no VDOM.
- **Components**: `N*` functions return DOM elements; `Request*` functions manage state in provided container.
- **Store**: Central state management in `store.ts` with CRUD operations and backend coordination.
- **Data Flow**: User → Signal → Store → Wails API → Store → DOM.

## Extensibility Rules

- **New Request Kind**:
  - Add plugin file in `internal/database/` with structs, functions, and register in `Plugins` map in `plugin.go`.
  - Add `Request*.ts` in `frontend/src/` following factory pattern.
  - Register in `App.ts` panelkaFactory.
  - Add types to `api.ts` and export struct in `main.go`.
- **Database**: JSON file `db.json`, versioned, migrate on startup.

## Post-Task Checks

- Run `bun run ci` for linting and typechecking (in frontend/).
- Run `bun run build` for frontend build (in frontend/).
- Run `go test ./internal/...` for backend tests.
- Run `wails build` for full app build.
- Verify new request kinds work end-to-end.
