# Code Style and Conventions

## Go (Backend)
- Follow standard Go idioms
- Use `zerolog` for logging
- Context-based cancellation
- Modular plugin structures
- Standard naming conventions (PascalCase for exported, camelCase for unexported)

## TypeScript (Frontend)
- Vanilla TypeScript with strict mode enabled
- Single quotes for strings
- Functional patterns where possible
- No frameworks, pure DOM manipulation
- Manual reactivity with signals
- JSX-like syntax without transpiler using `m()` function

## General
- No CSS frameworks or preprocessors
- Direct DOM APIs and native browser features
- Clear separation between backend (Go) and frontend (TypeScript)
- Plugin-based extensibility for new request kinds
- JSON file-based database with versioned migrations

## Restrictions
- Do not modify 3rd party dependencies (overriding styles, using !important)
- Do not use `overflow: hidden`
- Do not use `Array.forEach`
- No auto-formatting tools unless explicitly requested
- No patching or overwriting 3rd party dependencies</content>
</xai:function_call name="serena_write_memory">
<parameter name="memory_file_name">suggested_commands.md