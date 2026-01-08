# Post-Task Checklist

After completing any code changes:

1. **Lint and Typecheck**: Run `bun run ci` to ensure linting passes and TypeScript compiles
2. **Build**: Run `bun run build` to verify the frontend builds successfully
3. **Go Tests**: If backend changes, run `go test ./internal/...` to ensure tests pass
4. **Full Build**: For releases, run `wails build` to create the desktop application

## Guidelines for Changes
- Do not update code unrelated to the task
- Do not modify spacing, indentation, or formatting outside specific changes
- Only edit files and lines directly related to the task
- Do not complete additional tasks unless explicitly asked
- Do not run auto-formatting tools unless requested
- Include updates to AGENTS.md for structural/architectural changes
- Use Chrome MCP dev server on http://localhost:34115 for debugging

## Code Review Points
- Follow established patterns (plugin system, factory functions, manual reactivity)
- Maintain separation between backend (Go) and frontend (TypeScript)
- Use appropriate symbolic editing tools for precise changes
- Ensure backward compatibility when modifying symbols</content>
</xai:function_call name="serena_write_memory">
<parameter name="memory_file_name">architecture_patterns.md