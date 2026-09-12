# Adding New Plugins to Apiary

This guide explains how to add a new request kind plugin to apiary.

## Overview

Every request kind (HTTP, SQL, gRPC, Redis, JQ, Markdown, DIFF, MCP, SQLSource, HTTPSource) is a *plugin* with two halves:

- **Backend** (`main/database/<kind>.ts`): a `send<Kind>` function plus an `EmptyRequest` template, dispatched from `main/api.ts`.
- **Frontend** (`renderer/Request<Kind>.ts`): a UI factory, registered in the `createFrame` switch in `renderer/App.ts`.

The two halves connect through the typed IPC surface: `main.ts` (handlers) → `preload.ts` (bridge) → `global.d.ts` (`Api` interface).

## Where Things Live

```
shared/types.ts               # Kind enum, <Kind>Request / <Kind>Response types, RequestData / ResponseData / HistoryEntry unions
main/database/<kind>.ts       # Plugin implementation: send<Kind> + EmptyRequest
main/database/<kind>.test.ts  # Plugin unit tests
main/api.ts                   # emptyRequestForKind + Perform dispatch (or a sub-API namespace)
main/db.ts                    # JSON DB — no changes needed for new kinds (see step 6)
main.ts                       # ipcMain.handle(...) per channel
preload.ts                    # ipcRenderer.invoke(...) mirror, exposed via contextBridge
global.d.ts                   # Api interface — the typed IPC contract
renderer/Request<Kind>.ts     # UI factory (default export) + component test
renderer/App.ts               # createFrame switch (kind → UI module), panelkaFactory
```

## Step-by-Step Implementation

### 1. Types (`shared/types.ts`)

Add the kind and its data shapes:

```typescript
export enum Kind {
  // ... existing kinds
  Example = "example",
}

export type ExampleRequest = {
  field1: string,
  field2: number,
};

export type ExampleResponse = {
  result: string,
};

export type RequestData =
  // ... existing members
  | {kind: Kind.Example} & ExampleRequest
;
```

If the kind is performable (it has a `Perform` action), also add `ExampleResponse` to the `ResponseData` and `HistoryEntry` unions in the same file. Source kinds (like SQLSource, HTTPSource, MCP) have a `RequestData` member only — their data is fetched on demand through dedicated IPC endpoints, not through response history.

### 2. Backend Plugin (`main/database/example.ts`)

Each plugin is a module exporting an `EmptyRequest` constant and a `send<Kind>` function. Minimal real example (`main/database/jq.ts`):

```typescript
import type {JQRequest, JQResponse} from "@/types.ts";
import {jq} from "@/jq.ts";

export const EmptyRequest: JQRequest = {
  query: ".",
  json: `{ ... }`,
};

export async function sendJQ({json, query}: JQRequest): Promise<JQResponse> {
  return {response: await jq(json, query)};
}
```

`send<Kind>` may be sync (e.g. `sendDIFF` returns `DIFFResponse` directly) or async. Add unit tests in `main/database/example.test.ts` next to the module (see `main/database/jq.test.ts` for the pattern: `bun:test` with `mock.module` for external dependencies).

### 3. Dispatch (`main/api.ts`)

**Performable kinds** — add a case in both switches:

- `emptyRequestForKind(kind)`: return the empty request. Import the plugin's `EmptyRequest` if it has meaningful defaults (HTTP, SQL, JQ, MD, REDIS, MCP, SQLSource), or return an inline object for trivially-structured kinds (GRPC, DIFF, HTTPSource).
- `Perform(id)`: call `await sendExample(req.Data)`. After the switch, `createResponse(j, id, {SentAt, ReceivedAt, Response})` persists the exchange into the entry's response history automatically for every dispatched kind.

**Source kinds** — skip `Perform` and add a dedicated sub-API namespace instead, mirroring `export const GRPC = {...}` / `SQLSource` / `HTTPSource` / `MCP` in `main/api.ts`:

```typescript
export const Example = {
  ListThings: async (id: t.RequestID): Promise<Thing[]> => {
    // load entry, validate Kind, call plugin helpers
  },
};
```

### 4. IPC Surface (`main.ts` + `preload.ts` + `global.d.ts`)

Add one handler per channel in `main.ts`:

```typescript
ipcMain.handle("Example.ListThings", (_, id: string) => api.Example.ListThings(id));
```

Mirror it in `preload.ts` inside the `api: Api` object:

```typescript
Example: {
  ListThings: (a1: string): Promise<Thing[]> => ipcRenderer.invoke("Example.ListThings", a1),
},
```

And extend the `Api` interface in `global.d.ts` (this is what makes `window.api.Example.ListThings` type-safe in the renderer):

```typescript
Example: {
  ListThings: (_1: string) => Promise<Thing[]>,
},
```

### 5. Frontend Module (`renderer/RequestExample.ts`)

Default-export a factory following the existing pattern (see `renderer/RequestDIFF.ts` for a full reference):

```typescript
export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: t.HistoryEntry): void,
  unmount(): void,
} {
  // build DOM with m(), state with signal(), editors from ./components/editor.ts
  return {loaded, push_history_entry, unmount};
}
```

Conventions:

- Build DOM with `m()` from `renderer/lib/utils.ts` (no VDOM).
- Use `signal<T>()` only for watched state; plain locals otherwise.
- Styles via `css`/`css.raw` from `renderer/lib/styles.ts`.
- Errors render above the main content (see the hidden `el_error` pattern in `RequestDIFF.ts`).
- For auto-computing kinds, debounce rapid updates (500ms, as in `RequestDIFF.ts`).
- Clean up listeners/editors in `unmount()`.
- Add component tests in `renderer/RequestExample.test.ts` (see `renderer/components/CommandPalette.test.ts` for the `bun:test` + `happy-dom` pattern).

### 6. Registration (`renderer/App.ts`)

Import the module and add a case to `createFrame`:

```typescript
import RequestExample from "./RequestExample.ts";

// performable kind:
case t.Kind.Example: return RequestExample(el, show_request, on);

// source kind (no send/eye — they query sources on demand):
case t.Kind.Example:
  setDisplay(eye, false);
  return RequestExample(el, {update: on.update});
```

Source panes that display fetched data also register a dedicated viewer component in the layout (see the `TableViewer`, `EndpointViewer`, `ToolViewer` registrations later in `App.ts`, backed by `renderer/components/TableView.ts`, `EndpointViewer.ts`, `MCPToolViewer.ts`).

**No `main/db.ts` changes are needed**: the v1 migration switch in `db.ts` only handles kinds that existed in v1 databases; new kinds never appear there (`Create` writes the current format directly).

### 7. Post-Implementation Checks

```bash
bun run test             # unit + component tests
bun run test:integration # INTEGRATION=1 bun test integration.test.ts
bun run ci               # lint + typecheck
bun run build
bun run test:e2e         # builds first, then Playwright (renderer/e2e/)
bun run dist             # package the app
```

Manual end-to-end:

1. Launch the app.
2. Create a new request of the new kind.
3. Perform it; verify the response appears and lands in history.
4. Close and restart; verify the request and its history persist in `db.json`.

## Reference Example: DIFF

The DIFF kind is a good end-to-end reference:

- `shared/types.ts`: `Kind.DIFF = "diff"`, `DIFFRequest {left, right}`, `DIFFResponse {diff, stats, leftType, rightType}`, plus `ResponseData`/`HistoryEntry` members.
- `main/database/diff.ts`: sync `sendDIFF` (JSON structural diff or line diff via the `diff` package) + `diff.test.ts`.
- `main/api.ts`: inline `emptyRequestForKind` case `{left: "", right: ""}` and a `Perform` case.
- `renderer/RequestDIFF.ts`: default-export factory, split panes, 500ms debounced auto-perform, error banner above content.
- `renderer/App.ts`: `case t.Kind.DIFF: return RequestDIFF(el, show_request, on);`

## Best Practices

1. Keep plugin modules free of Electron imports so they stay unit-testable.
2. Exact assertions in tests (equality, not substring contains).
3. Make `emptyRequestForKind` defaults useful — the empty request is what users see on create.
4. Keep the `Api` interface in `global.d.ts` as the single source of truth; `preload.ts` and `main.ts` must stay in sync with it (the typechecker enforces this via `bun run ci`).