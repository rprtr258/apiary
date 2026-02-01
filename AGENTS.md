# AGENTS.md

## General Guidelines

- Never update code unrelated to the task.
- Never modify spacing, indentation, line breaks, or formatting outside specific changes.
- Only edit files and lines directly related to the task.
- Never complete additional tasks unless explicitly asked.
- Never run auto-formatting tools unless explicitly requested.
- Never change config files like `eslint.config.ts` or `tsconfig.json`.
- Never modify or patch 3rd-party dependencies, including overwriting styles or using `!important`.
- Never use `overflow: hidden`.
- Never disable linter checks unless explicitly requested.
- Never touch git (no commits, pushes, branches, etc.) unless explicitly requested by the user.
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
- **Create Release Tag**: `git tag v0.0.0 && git push origin v0.0.0` (triggers GitHub Actions release)

## Project Overview

apiary is a cross-platform desktop application for managing API requests (HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource, HTTPSource) using Go backend and vanilla TypeScript frontend via Wails.

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

### TypeScript Coding Conventions (from ESLint config)
- **Quotes**: Use double quotes (`"`) for strings, not single quotes
- **Semicolons**: Always use semicolons at the end of statements
- **Object curly spacing**: No spaces inside braces: `{key: value}` not `{ key: value }`
- **Commas**: Use trailing commas in multiline objects/arrays/interfaces
- **Interface members**: Use commas to separate interface entries (not semicolons)
- **Boolean comparisons**: Use strict boolean expressions: `if (value === true)` not `if (value)`, `if (value === false)` not `if (!value)`
- **Equality**: Use `===` and `!==` instead of `==` and `!=`
- **Array methods**: Avoid `forEach`; use `for...of` or functional methods that return values
- **Type imports**: Use `import type` for type-only imports when appropriate

### Examples of Correct vs Incorrect Code

**Quotes:**
```typescript
// Correct
const name = "John";
// Incorrect  
const name = 'John';
```

**Semicolons:**
```typescript
// Correct
const x = 1;
const y = 2;
// Incorrect
const x = 1
const y = 2
```

**Object spacing:**
```typescript
// Correct
const obj = {key: "value"};
// Incorrect
const obj = { key: "value" };
```

**Interface commas:**
```typescript
// Correct
interface User {
  name: string,
  age: number,
}
// Incorrect
interface User {
  name: string;
  age: number;
}
```

**Boolean comparisons:**
```typescript
// Correct
if (value === true) { /* handle true */ }
if (value === false) { /* handle false */ }
if (value === null) { /* handle null */ }
if (value === undefined) { /* handle undefined */ }
// Incorrect
if (value) { /* truthy check */ }
if (!value) { /* falsy check */ }
```

**Array methods:**
```typescript
// Correct
const doubled = numbers.map(n => n * 2);
for (const item of items) { /* process */ }
// Incorrect
numbers.forEach(n => console.log(n));
```

## Architecture Patterns

- **Backend Plugins**: Each request kind (HTTP, SQL, etc.) has a plugin in `internal/database/` with `Perform`, `create`, `update`, `createResponse` functions, and Request/Response structs implementing `Kind()` and `MarshalJSON()`. HTTPSource is a source plugin for generating HTTP requests from OpenAPI specs.
- **Frontend Factories**: Each request kind has a `Request*.ts` factory function taking `(el, signal, handlers)` and returning `{loaded, push_history_entry, unmount}`. See `frontend` skill for detailed frontend engineering guidelines.
- **Reactivity**: Use `signal<T>()` for state, but only if it is watched by using `sub`, otherwise use mutable locals. Use `m()` for DOM building, no VDOM.
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

## Release Process

### Version Management
- **Version System**: Located in `internal/version/version.go`
- **Build-time Injection**: Version, commit, and date set via `ldflags` during build
- **Database Versioning**: `app_version` field stored in database JSON for migration tracking
- **Version Format**: Semantic versioning (e.g., `vX.Y.Z`)

### Creating a Release
1. **Tag Creation**: `git tag vX.Y.Z`
2. **Push Tag**: `git push origin vX.Y.Z` (triggers GitHub Actions)
3. **Automated Build**: GitHub Actions builds for Linux, macOS, and Windows
4. **Release Creation**: Binaries attached to GitHub Release with auto-generated notes

### GitHub Actions Workflow
- **File**: `.github/workflows/release.yml`
- **Triggers**: Push to tags matching `v[0-9]+.[0-9]+.[0-9]+`
- **Platforms**:
  - Linux (amd64): `apiary-linux-amd64`
  - macOS (amd64/arm64): `apiary-darwin-amd64`, `apiary-darwin-arm64`
  - Windows (amd64): `apiary-windows-amd64.exe`
- **Version Injection**: Uses `ldflags` to set version info in binaries
- **Database Compatibility**: New databases include `app_version` field

### Testing Releases
- Use `workflow_dispatch` with test version (e.g., `0.0.0-test`)
- Check artifact naming and binary functionality
- Verify version appears in app logs on startup

### Window Visibility Behavior
- **Development builds** (version = "(devel)" or pseudo-version): Window starts visible
- **Release builds** (version = "vX.Y.Z"): Window starts hidden (`StartHidden: true`)
- Controlled by `version.IsRelease()` in `main.go`
- Helps with development workflow while maintaining clean startup for end users

## Frontend Development

When working on frontend code, use the `frontend` skill for detailed guidance on vanilla TypeScript development patterns, component architecture, and DOM manipulation. The skill provides specific rules for:
- Component factory functions (`Request*.ts` pattern)
- DOM building with `m()` utility
- Signal-based reactivity
- Store-based state management
- Error handling and performance optimization
