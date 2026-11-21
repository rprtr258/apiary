import {appendFileSync, mkdirSync, openSync} from "fs";
import path from "path";
import {format} from "util";

let fd: number | null = null;

function write(processName: string, level: string, line: string): void {
  if (fd === null)
    return;
  try {
    appendFileSync(fd, `[${new Date().toISOString()}] [${processName}] [${level}] ${line}\n`);
  } catch {
    // A failed log write (full disk, removed file) must never take the app
    // down or retry forever - mirroring is silently switched off.
    fd = null;
  }
}

const native = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Creates/truncates the log file and mirrors main-process console output into
// it. With "w" the file holds only the current session's logs; with no file it
// is created. Call once at startup, before anything logs.
export function startFileLogging(filePath: string): void {
  try {
    mkdirSync(path.dirname(filePath), {recursive: true});
    fd = openSync(filePath, "w");
  } catch {
    // Unavailable log file must not break startup; console still works.
    fd = null;
    return;
  }
  for (const level of ["log", "warn", "error", "info", "debug"] as const) {
    console[level] = (...args: unknown[]) => {
      native[level](...args);
      write("main", level, format(...args));
    };
  }
}

// Renderer console messages, forwarded from the window's console-message event.
export function logRenderer(level: string, message: string, sourceId: string, lineNumber: number): void {
  const where = sourceId === "" ? "" : ` (${sourceId}:${lineNumber})`;
  write("renderer", level, message + where);
}
