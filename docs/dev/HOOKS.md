# State Primitives ("Hooks")

Apiary's frontend has no framework; state management is built from a few small primitives. This document describes the primitives that actually exist in the codebase.

> Note: an earlier version of this document described a headless-hooks architecture (`useTabs`, `useRequest`, `useResponse`, `useInput`, `useSelect`, `useButton`). Those hooks were never implemented — do not look for them. The patterns below are the real equivalents.

## `signal<T>()` — reactive state

**Location**: `renderer/lib/utils.ts`

```typescript
const value = signal<T>(initial);
value.value;                 // read
value.value = next;          // write
value.update(fn);            // write via function
value.sub(fn | generator);   // subscribe to changes
```

Rule of thumb (see `AGENTS.md`): use `signal<T>()` only when something subscribes via `sub`; otherwise a plain local variable is enough.

Example — the eye toggle in `renderer/App.ts`:

```typescript
const show_request = signal(true);
eye_unsub = show_request.sub(function*() {
  while (true) {
    const value = yield;
    eye.title = value ? "Hide request" : "Show request";
  }
}());
```

## `useLocalStorage<T>()` — persisted state

**Location**: `renderer/lib/localStorage.ts`

```typescript
import {useLocalStorage} from "./lib/localStorage.ts";

const expanded = useLocalStorage<Record<string, boolean>>("sidebar-expanded", {});
expanded.value;              // read (initializes from localStorage, falls back to init)
expanded.value = {...};      // write (persists to localStorage)
```

Companions in the same module:

- `isLocalStorageAvailable()` — guards private-browsing modes
- `clearKeysWithPrefix(prefix)` — bulk clear (useful for migrations)

Used by `renderer/sidebar/tree.ts` (persisting expanded tree keys) and `renderer/store.ts`.

## Cache pattern — `renderer/sidebar/sourceCache.ts`

Source metadata (SQL tables, OpenAPI endpoints, MCP tools) is fetched on demand and cached with a staleness window so the sidebar doesn't re-query the backend on every render:

```typescript
// tableCache / endpointCache / toolCache follow the same shape:
// - fetch once per entry, invalidate after a staleness window
// - a version signal bumps when a cache changes, and subscribers re-render on it
```

When adding a new source kind with browsable metadata, follow this pattern rather than ad-hoc fetch-on-render.

## Debounced auto-update

UI modules that recompute on every keystroke (e.g. DIFF) debounce updates:

```typescript
// renderer/RequestDIFF.ts
if (updateTimeout !== null) window.clearTimeout(updateTimeout);
updateTimeout = window.setTimeout(() => { /* perform + render */ }, 500); // 500ms debounce
```

## The UI-module contract (the "hook" of request panes)

Every `renderer/Request<Kind>.ts` factory receives its inputs and returns its lifecycle — this is the component-level seam:

```typescript
export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {update: (patch: Partial<Request>) => Promise<void>, send: () => Promise<void>},
): {
  loaded(r: get_request): void,
  push_history_entry(he: t.HistoryEntry): void,
  unmount(): void,
}
```

- `loaded(r)` — initialize from the fetched request
- `push_history_entry(he)` — render the latest history entry
- `unmount()` — tear down editors/listeners/timers

Source kinds receive only `{update}` and hide the send/eye affordances (see `createFrame` in `renderer/App.ts`).

## Testing state primitives

Primitives are plain functions, so they test directly with `bun:test` (`renderer/test.setup.ts` is preloaded; DOM tests use `happy-dom`):

```typescript
import {describe, test, expect} from "bun:test";
import {signal} from "../lib/utils.ts";

describe("signal", () => {
  test("sub sees updates", () => {
    const s = signal(1);
    const seen: number[] = [];
    s.sub(v => seen.push(v));
    s.value = 2;
    expect(seen).toEqual([2]);
  });
});
```