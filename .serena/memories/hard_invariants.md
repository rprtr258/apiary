# Hard Invariants

- Frontend: Vanilla TypeScript only, no frameworks, no preprocessors, no CSS frameworks.
- No `overflow: hidden`, no `Array.forEach`, no `!important`.
- No modifying 3rd-party dependencies or overwriting their styles.
- No auto-formatting tools unless explicitly requested.
- Backend: Go with zerolog, context-based cancellation, plugin architecture.
- Database: JSON-based, versioned, custom migration on startup.
- UI: Manual reactivity with signals, DOM builder `m()`, no VDOM.
- Component patterns: Element creators (N*), Factory functions (Request*).
- Extensibility: Add plugins in internal/database/, register in plugin.go, add Request*.ts in frontend/src/, register in App.ts panelkaFactory.
- Persistence: db.json adjacent to app binary.
