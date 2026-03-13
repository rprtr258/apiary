# Adding New Plugins to Apiary

This guide explains how to add a new request kind plugin to the apiary application.

## Overview

Apiary uses a plugin architecture for different request types (HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource, HTTPSource, DIFF). Each plugin follows a consistent pattern for backend implementation, frontend UI, and database persistence.

## Plugin Architecture

### Backend Structure
```
internal/database/
├── plugin.go           # Plugin registry and interface
├── plugin_*.go        # Individual plugin implementations
├── v2.go              # Database migration/decoder
└── database.go        # Database encoder/decoder
```

### Frontend Structure
```
frontend/src/
├── Request*.ts        # Plugin UI components
├── App.ts            # Plugin registration in createFrame
├── types.ts          # TypeScript type definitions
└── Request*.test.ts  # Component tests
```

## Step-by-Step Implementation

### 1. Backend Plugin Implementation

#### 1.1 Create Plugin File
Create `internal/database/plugin_<name>.go` with the following structure:

```go
package database

import (
    "context"
    "encoding/json"
    "fmt"
    "strings"
)

const Kind<NAME> Kind = "<name>"  // lowercase name

type <NAME>Request struct {
    // Request fields
    Field1 string `json:"field1"`
    Field2 string `json:"field2"`
}

func (<NAME>Request) Kind() Kind { return Kind<NAME> }

type <NAME>Response struct {
    // Response fields
    Result string `json:"result"`
    Stats  string `json:"stats"`
}

func (<NAME>Response) Kind() Kind { return Kind<NAME> }

var plugin<NAME> = plugin{
    EmptyRequest:   <NAME>EmptyRequest,
    enum:           enumElem[Kind]{Kind<NAME>, "<NAME>"},
    Perform:        send<NAME>,
    create:         (*DB).create,
    update:         (*DB).update,
    createResponse: true,  // Set to false if responses shouldn't be stored
}

var <NAME>EmptyRequest = <NAME>Request{
    // Default values
    Field1: "default1",
    Field2: "default2",
}

func send<NAME>(_ context.Context, request EntryData) (EntryData, error) {
    req := request.(<NAME>Request)
    // Implementation logic
    return <NAME>Response{
        Result: "result",
        Stats:  "stats",
    }, nil
}
```

#### 1.2 Register Plugin
Add to `internal/database/plugin.go`:
```go
var Plugins = map[Kind]plugin{
    // ... existing plugins
    Kind<NAME>: plugin<NAME>,
}
```

#### 1.3 Update Database Migration
In `internal/database/v2.go`:

1. **Add to decoder arguments** (line ~202):
```go
    diff map[RequestID]pluginv1[DIFFRequest, DIFFResponse],
    <name> map[RequestID]pluginv1[<NAME>Request, <NAME>Response],
```

2. **Add to switch statement** (line ~223):
```go
    case Kind<NAME>:
        reqe, responses = mapRequestDataV1(reqv1.ID, <name>)
```

3. **Add to decoder list** (line ~288):
```go
    decoderv1plugin[<NAME>Request, <NAME>Response](),
```

**Important**: If adding the 12th plugin, you'll need to:
- Create `Map12` function (copy pattern from `Map11`)
- Update `decoderV1` to use `Map12`
- Add the new decoder to the list

#### 1.4 Update Database Encoder
In `internal/database/database.go` (line ~100), add:
```go
    "<name>":        encod[<NAME>Request, <NAME>Response](v),
```

#### 1.5 Update Application Handlers
In `internal/app/handlers.go` (line ~191), add to `parseRequestt` map:
```go
    database.Kind<NAME>: parse[database.<NAME>Request],
```

#### 1.6 Export Types
In `main.go`, add to `ExportTypes` function parameters:
```go
    database.<NAME>Request, database.<NAME>Response,
```

#### 1.7 Create Tests
Create `internal/database/plugin_<name>_test.go` with comprehensive tests:
- Unit tests for plugin functions
- Integration tests for `Perform` function
- Exact equality checks (not substring contains)

### 2. Frontend Implementation

#### 2.1 Create Component
Create `frontend/src/Request<NAME>.ts` following the factory pattern:

```typescript
import { m } from "../lib";
import { store } from "../store";
import type { RequestData, ResponseData } from "../types";

export function Request<NAME>(
    el: HTMLElement,
    signal: AbortSignal,
    handlers: {
        push_history_entry: (response: ResponseData) => void;
    }
) {
    // State management
    const state = signal<RequestData>({ kind: "<name>", ... });

    // UI rendering
    const render = () => {
        m.render(el, m("div", [
            // Component UI
        ]));
    };

    // Initial render
    render();

    return {
        loaded: (data: RequestData) => {
            // Load existing data
            state.set(data);
            render();
        },
        push_history_entry: handlers.push_history_entry,
        unmount: () => {
            // Cleanup
        }
    };
}
```

#### 2.2 Update App Integration
In `frontend/src/App.ts`, add to `createFrame` switch:
````md
```typescript
case "diff":
    return RequestDIFF(el, signal, handlers);
case "<name>":
    return Request<NAME>(el, signal, handlers);
```

#### 2.3 Update Type Definitions
In `frontend/src/types.ts`, add to unions:
```typescript
export type RequestData =
    | { kind: "http"; /* existing fields */ }
    | { kind: "<name>"; field1: string; field2: string };

export type ResponseData =
    | { kind: "http"; /* existing fields */ }
    | { kind: "<name>"; result: string; stats: string };
```

#### 2.4 Create Component Tests
Create `frontend/src/Request<NAME>.test.ts` with:
- Component structure tests
- State management tests
- Integration tests

### 3. Post-Implementation Checks

#### 3.1 Run Tests
```bash
# Backend tests
go test ./internal/database/... -v
go test ./internal/... -v

# Frontend type checking
cd frontend && bun run ci

# Frontend build
cd frontend && bun run build
```

#### 3.2 Build Application
```bash
# Full application build
wails build
```

#### 3.3 Test End-to-End
1. Launch application
2. Create new <NAME> request
3. Perform operation
4. Close and restart application
5. Verify request persists with correct data

## Common Patterns and Conventions

### Request/Response Design
- **Simple plugins**: Store responses in history (`createResponse: true`)
- **Compute-only plugins**: Don't store responses (`createResponse: false`) like MD, DIFF
- **Source plugins**: No `Perform` function, handled separately (SQLSource, HTTPSource)

### UI Patterns
- Use `signal<T>()` for reactive state
- Use `m()` for DOM building (no VDOM)
- Follow existing component patterns
- Real-time updates with 500ms debounce

### Error Handling
- Display errors above main content
- Validate inputs before sending to backend
- Show loading states during operations

### Performance
- Debounce rapid updates (500ms)
- Clean up event listeners on unmount
- Use efficient DOM updates

## Troubleshooting

### Plugin Not Persisting
1. Check encoder has `"<name>": encod[...](v)` in `database.go`
2. Verify decoder includes plugin in `v2.go`
3. Check `parseRequestt` map in `handlers.go`

### Type Errors
1. Verify types exported in `main.go`
2. Check TypeScript type definitions
3. Run `bun run ci` for frontend type checking

### Build Failures
1. Run `go test ./internal/...` for backend issues
2. Run `cd frontend && bun run build` for frontend issues
3. Check Wails bindings generation

### Database Migration Issues
If adding 12th+ plugin:
1. Create `MapN` function in `v2.go`
2. Update `decoderV1` to use `MapN`
3. Add all decoders to the list

## Example: DIFF Plugin Reference

The DIFF plugin demonstrates:
- **Structural JSON diffing**: Adapted from it-tools algorithm
- **Mixed content handling**: JSON vs text detection
- **No response history**: `createResponse: false`
- **Complex UI**: Split panes with real-time updates
- **Custom diff logic**: Using `difflib` opcodes for line-by-line diffs

Key files to examine:
- `internal/database/plugin_diff.go` - Backend implementation
- `frontend/src/RequestDIFF.ts` - Frontend component
- `internal/database/v2.go` - Database migration updates
- `internal/database/database.go` - Encoder fix (was missing!)

## Best Practices

1. **Follow existing patterns**: Mimic code style and architecture
2. **Comprehensive tests**: Include exact equality checks
3. **Type safety**: Ensure TypeScript and Go types match
4. **Error handling**: Graceful degradation for invalid inputs
5. **Performance**: Debounce rapid updates, clean up resources
6. **Documentation**: Update this guide with new patterns

