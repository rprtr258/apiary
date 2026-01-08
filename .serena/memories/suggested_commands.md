# Development Commands

## Frontend (TypeScript)
- `bun run dev` - Start Vite dev server (port 5174)
- `bun run build` - Build frontend with Vite
- `bun run lint` - Run ESLint on TypeScript/JSON files
- `bun run ci` - Run linting and TypeScript checking

## Backend (Go)
- `go test ./internal/...` - Run Go tests
- `go vet` - Check for Go code issues

## Full Application
- `wails build` - Build desktop application (outputs to build/)
- `docker-compose up` - Start example databases/servers for testing
- `docker-compose down` - Stop example services

## Setup
- `bun install` - Install frontend dependencies
- `go mod download` - Download Go dependencies

## After Task Completion
- Run `bun run ci` to lint and typecheck
- Run `bun run build` to ensure build succeeds
- Run Go tests with `go test ./internal/...`</content>
</xai:function_call name="serena_write_memory">
<parameter name="memory_file_name">post_task_checklist.md