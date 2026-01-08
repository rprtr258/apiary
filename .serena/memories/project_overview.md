# Project Overview

**Purpose**: apiary is a cross-platform desktop application for creating, executing, managing, and organizing API requests of various kinds including HTTP, SQL, gRPC, Redis, JQ, Markdown, and others.

**Tech Stack**:
- Backend: Go with Wails for desktop integration
- Frontend: Vanilla TypeScript (no frameworks), CodeMirror editors, GoldenLayout for UI
- Database: JSON-based with custom migration
- Build: Wails for desktop app bundling

**Architecture**:
- Backend plugins system for request kinds
- Frontend factory pattern for UI components
- Manual reactivity with signals
- Direct DOM manipulation

**Key Directories**:
- `cmd/`: Test executables (e.g., ClickHouse client, HTTP servers)
- `internal/app/`: Core backend logic and Wails bindings
- `internal/database/`: Plugin system, request/response types, JSON DB
- `frontend/`: TypeScript UI components and logic</content>
</xai:function_call name="serena_write_memory">
<parameter name="memory_file_name">code_style_and_conventions.md