# Plugin Implementation Checklist

## Backend (Go)

### 1. Create Plugin File (`internal/database/plugin_*.go`)
- [ ] Define `Kind<NAME> = "<name>"` constant
- [ ] Create `<NAME>Request` struct with `json` tags
- [ ] Create `<NAME>Response` struct with `json` tags
- [ ] Implement `Kind()` methods for both structs
- [ ] Create `plugin<NAME>` with `EmptyRequest`, `enum`, `Perform`, `create`, `update`, `createResponse`
- [ ] Define `send<NAME>` function (perform logic)
- [ ] Create `EmptyRequest` default values

### 2. Register Plugin (`internal/database/plugin.go`)
- [ ] Add `Kind<NAME>: plugin<NAME>` to `Plugins` map

### 3. Update Database Migration (`internal/database/v2.go`)
- [ ] Add to decoder arguments: `<name> map[RequestID]pluginv1[<NAME>Request, <NAME>Response]`
- [ ] Add to switch statement: `case Kind<NAME>: reqe, responses = mapRequestDataV1(reqv1.ID, <name>)`
- [ ] Add to decoder list: `decoderv1plugin[<NAME>Request, <NAME>Response]()`
- [ ] **If 12th+ plugin**: Create `MapN` function and update `decoderV1`

### 4. Update Database Encoder (`internal/database/database.go`)
- [ ] Add to encoder: `"<name>": encod[<NAME>Request, <NAME>Response](v)`

### 5. Update Application Handlers (`internal/app/handlers.go`)
- [ ] Add to `parseRequestt` map: `database.Kind<NAME>: parse[database.<NAME>Request]`

### 6. Export Types (`main.go`)
- [ ] Add to `ExportTypes` parameters: `database.<NAME>Request, database.<NAME>Response`

### 7. Create Tests (`internal/database/plugin_*_test.go`)
- [ ] Unit tests for plugin functions
- [ ] Integration tests for `Perform` function
- [ ] Exact equality checks (not substring contains)

## Frontend (TypeScript)

### 1. Create Component (`frontend/src/Request<NAME>.ts`)
- [ ] Factory function `Request<NAME>(el, signal, handlers)`
- [ ] State management with `signal<T>()`
- [ ] UI rendering with `m()`
- [ ] Real-time updates with 500ms debounce
- [ ] Error handling above main content
- [ ] Cleanup on unmount

### 2. Update App Integration (`frontend/src/App.ts`)
- [ ] Add to `createFrame` switch: `case "<name>": return Request<NAME>(el, signal, handlers)`

### 3. Update Type Definitions (`frontend/src/types.ts`)
- [ ] Add to `RequestData` union: `| { kind: "<name>"; ... }`
- [ ] Add to `ResponseData` union: `| { kind: "<name>"; ... }`

### 4. Create Component Tests (`frontend/src/Request<NAME>.test.ts`)
- [ ] Component structure tests
- [ ] State management tests
- [ ] Integration tests

## Post-Implementation

### 1. Run Tests
```bash
go test ./internal/database/... -v
go test ./internal/... -v
cd frontend && bun run ci
cd frontend && bun run build
```

### 2. Build Application
```bash
wails build
```

### 3. Test End-to-End
- [ ] Create new request
- [ ] Perform operation
- [ ] Close/restart application
- [ ] Verify persistence

## Common Issues & Solutions

### Plugin Not Persisting
- ✅ Check encoder has `"<name>": encod[...](v)` in `database.go`
- ✅ Verify decoder includes plugin in `v2.go`
- ✅ Check `parseRequestt` map in `handlers.go`

### Type Errors
- ✅ Verify types exported in `main.go`
- ✅ Check TypeScript type definitions
- ✅ Run `bun run ci` for frontend type checking

### 12th+ Plugin Issue
- ✅ Create `MapN` function in `v2.go`
- ✅ Update `decoderV1` to use `MapN`
- ✅ Add all decoders to the list

## Quick Reference

### Plugin Types
- **Simple plugin**: `createResponse: true` (stores history)
- **Compute-only**: `createResponse: false` (no history, like MD, DIFF)
- **Source plugin**: No `Perform` function (like SQLSource, HTTPSource)

### Key Decisions
1. **Response storage**: Should responses be saved to history?
2. **Real-time updates**: Use 500ms debounce
3. **Error display**: Show errors above main content
4. **Default values**: Provide sensible `EmptyRequest`

### Testing Requirements
- Backend: Exact equality checks (not substring)
- Frontend: Component structure and integration
- End-to-end: Persistence across restarts