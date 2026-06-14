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
- Run `bun run ci` and `bun run build` after any code changes to ensure linting, typechecking, and build succeed.
- Include updates to `AGENTS.md` for structural or architectural changes.
- Use context-based cancellation in backend code.
- Use structured logging in backend code.
- Maintain plugin architecture for request kinds.

## Commands

- **Lint and Typecheck**: `bun run ci`
- **Build Frontend**: `bun run build`
- **Build Desktop App**: `bun run dist:linux` (or `dist:mac` / `dist:win`)
- **Run Unit Tests**: `bun run test`
- **Run E2E Tests**: `bun run test:e2e`
- **Create Release Tag**: `git tag v0.0.0 && git push origin v0.0.0` (triggers GitHub Actions release)

## Project Overview

apiary is a cross-platform desktop application for managing API requests (HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource, HTTPSource) using Electron backend and vanilla TypeScript frontend.

- **Tech Stack**: TypeScript, Electron, Vite, GoldenLayout, CodeMirror, JSON DB.
- **Directories**:
  - `database/`: Backend service implementations (HTTP, SQL, gRPC, Redis, etc.).
  - `frontend/`: Vanilla TypeScript UI components and logic.
  - `types/`: Shared TypeScript type definitions.

## Code Style

- **TypeScript**: Standard idioms, strict mode, double quotes, const over let, prefer functional style (e.g., `data.map(item => item.value)`), no frameworks, direct DOM APIs.
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

- **Backend Services**: Each request kind (HTTP, SQL, etc.) has a service module in `database/` with a `send*` function and a `*EmptyRequest` constant.
- **Frontend Factories**: Each request kind has a `Request*.ts` factory function taking `(el, signal, handlers)` and returning `{loaded, push_history_entry, unmount}`. See `frontend` skill for detailed frontend engineering guidelines.
- **Reactivity**: Use `signal<T>()` for state, but only if it is watched by using `sub`, otherwise use mutable locals. Use `m()` for DOM building, no VDOM.
- **Components**: `N*` functions return DOM elements; `Request*` functions manage state in provided container.
- **Store**: Central state management in `store.ts` with CRUD operations and backend coordination.
- **Electron IPC**: Main process in `main.ts` handles IPC from renderer via `ipcMain.handle()`. Preload script (`preload.ts`) exposes secure API via `contextBridge.exposeInMainWorld`. Renderer communicates through `window.api`.
- **Data Flow**: User → Signal → Store → IPC (window.api) → Main Process → Store → DOM.

### Architecture Documentation

- **Read First**: Before making architectural changes, read `docs/dev/ARCHITECTURE.md` to understand current architecture.
- **Keep Updated**: After architectural changes, update `docs/dev/ARCHITECTURE.md` to reflect the new state.
- **Document Seams**: When extracting modules, document the seam (interface) in the architecture doc.
- **Vocabulary**: Use the terms from ARCHITECTURE.md (module, interface, seam, adapter, depth) for clear communication.

## Extensibility Rules

- **New Request Kind**:
  - Add service file in `database/` with `send*` function and `*EmptyRequest` constant.
  - Add `Request*.ts` in `frontend/` following factory pattern.
  - Register in `App.ts` panelkaFactory.
  - Add types to `types/`.
  - Add IPC handler in `main.ts`.
  - Add preload bridge in `preload.ts`.
  - Add type definition in `global.d.ts`.

## Post-Task Checks

- Run `bun run ci` for linting and typechecking.
- Run `bun run build` for full build.
- Run `bun run test` for unit tests.
- Verify new request kinds work end-to-end.

## Release Process

### Version Management
- **Version System**: In `package.json` (`"version"` field) and git tags.
- **Database Versioning**: `app_version` field stored in database JSON for migration tracking.
- **Version Format**: Semantic versioning (e.g., `vX.Y.Z`).

### Creating a Release
1. **Tag Creation**: `git tag vX.Y.Z`
2. **Push Tag**: `git push origin vX.Y.Z` (triggers GitHub Actions)
3. **Automated Build**: GitHub Actions builds for Linux, macOS, and Windows
4. **Release Creation**: Binaries attached to GitHub Release with auto-generated notes

### GitHub Actions Workflow
- **File**: `.github/workflows/release.yml`
- **Triggers**: Push to tags matching `v[0-9]+.[0-9]+.[0-9]+`, or `workflow_dispatch`
- **Build Tool**: `electron-builder` packages the Electron app
- **Platforms**:
  - Linux (amd64): `apiary-linux-amd64.AppImage`
  - macOS (amd64): `apiary-darwin-x64.dmg`
  - macOS (arm64): `apiary-darwin-arm64.dmg`
  - Windows (amd64): `apiary-win-x64.exe` (NSIS installer)
- **Artifact Names**: Defined in `package.json` under `"build"` config
- **Database Compatibility**: New databases include `app_version` field

## Frontend Development

When working on frontend code, use the `frontend` skill for detailed guidance on vanilla TypeScript development patterns, component architecture, and DOM manipulation. The skill provides specific rules for:
- Component factory functions (`Request*.ts` pattern)
- DOM building with `m()` utility
- Signal-based reactivity
- Store-based state management
- Error handling and performance optimization