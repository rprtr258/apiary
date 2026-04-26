# Apiary Architecture

## Overview

Apiary provides access to multiple APIs (REST/GRPC/databases) in a "two pane" setup (query → result), plus markdown editor/viewer and diff capabilities. Target: individual developers.

## Directory Structure

```
apiary/
├── main.go                 # Application entry point
├── internal/
│   ├── app/
│   │   └── app.go        # Application bootstrap (holds DB)
│   ├── database/         # Plugin system (backend)
│   │   ├── plugin.go     # Plugin registry + interface
│   │   ├── plugin_*.go # Individual plugins (HTTP, SQL, etc.)
│   │   ├── v2.go        # Database migration/decoder
│   │   └── models.go    # Core types (Request, Response, EntryData)
│   ├── json/            # JSON utilities
│   └── version/         # Version info
├── frontend/
│   ├── src/
│   │   ├── App.ts       # Main app + command palette handling
│   │   ├── store.ts     # State management
│   │   ├── Sidebar.ts   # Tree + caching (tightly coupled)
│   │   ├── Request*.ts # UI for each request type (9 files)
│   │   ├── lib/         # Utilities
│   │   │   └── localStorage.ts  # Extracted localStorage module
│   │   └── components/  # Reusable UI components
│   └── dist/           # Built assets (embedded)
└── docs/dev/           # Developer documentation
```

## Key Modules

### Backend: Plugin System

**Interface**: `EntryData` + `plugin` struct
**Implementation**: Each plugin in `plugin_*.go` files

The plugin system defines the contract between frontend requests and backend execution:
- Each plugin has a `Kind` (string identifier)
- Each plugin implements `Perform(context, EntryData) -> (EntryData, error)`
- Plugins are registered in `Plugins` map in `plugin.go`

**Plugins** (9 total):
| Kind | Purpose | Stores Response? |
|------|---------|-----------------|
| HTTP | REST API calls | Yes |
| SQL | Database queries | Yes |
| GRPC | gRPC calls | Yes |
| JQ | JSON processing | Yes |
| Redis | Redis operations | Yes |
| MD | Markdown render | No |
| DIFF | API diffing | No |
| SQLSource | DB metadata source | N/A |
| HTTPSource | OpenAPI source | N/A |

### Frontend: Request UI Modules

**Files**: `RequestHTTP.ts`, `RequestSQL.ts`, ..., `RequestHTTPSource.ts` (9 files)

Each module follows identical interface:
```typescript
function createRequestUI(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {update, send},
): {loaded, push_history_entry, unmount}
```

**Pattern**: These are intentionally separate files despite similar structure. They differ in:
- Request form rendering
- Response display (table for SQL, text for HTTP, etc.)

The deletion test: these are pass-throughs but that's OK - they're UI adapters, not shallow logic.

### Frontend: Sidebar (Caching + UI)

**File**: `frontend/src/Sidebar.ts` (~900 lines)

Mixes:
- Tree UI rendering  
- Table/endpoint caching (`tableCache`, `endpointCache`)
- Data fetching (`fetchTables`, `fetchEndpoints`)
- Context menus
- localStorage (`expanded-keys`)

**Deletion test result**: PASSES - caching is earning its keep. The complexity concentrates here rather than scattering to callers.

**Note**: The caching is tightly coupled to UI (calls `updateTree()` after fetch). Extracting would require event system.

### Frontend: Store

**File**: `frontend/src/store.ts` (~350 lines)

Handles:
- Request state (`requests`, `requests2`)
- Layout state (`layoutConfig`, tab navigation)
- API calls (`fetch`, `createRequest`, `duplicate`, etc.)

Already has good interface seam. Could split implementation into `RequestStore` + `LayoutBridge` but not necessary.

### Frontend: App

**File**: `frontend/src/App.ts` (~400 lines)

Handles:
- Main layout
- Command palette (4 instances)
- Keyboard shortcuts (~20)
- Modal dialogs (create, rename)

### Frontend: LocalStorage

**Extracted module**: `frontend/src/lib/localStorage.ts`

Provides clean interface:
```typescript
useLocalStorage<T>(key: string, init: T): {get value(), set value()}
```

Used by Sidebar for persisting expanded tree keys.

## Seams

| Seam | What varies | Adapters |
|------|-----------|----------|
| Plugin interface | Request type | 9 plugins (backend) |
| Request UI | Display format | 9 UI modules |
| localStorage | Storage backend | Browser localStorage |

## Testing Strategy

- **Backend**: Unit tests for each plugin in `plugin_*_test.go`
- **Frontend**: Component tests in `Request*.test.ts`

Tests cross at the interface, not past it.

## Adding New Plugins

See [ADDING_NEW_PLUGINS.md](ADDING_NEW_PLUGINS.md) for step-by-step guide.

## Architecture Decisions (ADRs)

- **Plugin per request type**: Each request kind (HTTP, SQL, etc.) is a separate plugin. Adding new plugin requires backend + frontend changes.
- **No response history for compute-only plugins** (MD, DIFF): Only source plugins store responses.
- **LocalStorage at seam**: Extracted to `lib/localStorage.ts` for testability.

## Known Complexity

1. **Sidebar caching is tightly coupled** to UI rendering - difficult to extract cleanly
2. **Database migration** (`v2.go`) is complex - handles all plugin versions
3. **9 request UI modules** - structurally similar but intentionally separate

## Vocabulary

- **Module**: Any code with interface + implementation (function, class, file)
- **Interface**: Everything a caller must know (types, invariants, error modes)
- **Seam**: Where interface lives; where behaviour can vary
- **Adapter**: Concrete thing satisfying interface at seam
- **Depth**: Leverage at interface (lots of behavior behind small surface)