// Electron hands the console-message event each argument flattened with
// String(), so objects reach the main-process log file as "[object Object]"
// (arrays even lose their brackets). Wrapping the renderer console to pass a
// single pre-formatted string per call keeps the full values in the log.

function stringify(value: unknown): string {
  // Errors stringify to "{}" in JSON (message/stack are non-enumerable).
  if (value instanceof Error)
    return value.stack ?? String(value);
  // JSON.stringify's declared string return lies: functions, symbols and
  // toJSON->undefined values actually yield undefined, so check at runtime
  // instead of trusting the type.
  try {
    const json: unknown = JSON.stringify(value);
    return typeof json === "string" ? json : String(value);
  } catch {
    // Cyclic or otherwise unserializable - no worse than the flat String().
    return String(value);
  }
}

export function installStringifiedConsole(): void {
  // Captured at install time, not import time, so callers can shim console
  // first (tests do).
  const native = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };
  for (const level of ["log", "warn", "error", "info", "debug"] as const) {
    console[level] = (...args: unknown[]) => {
      native[level](args.map(arg => typeof arg === "string" ? arg : stringify(arg)).join(" "));
    };
  }
}
