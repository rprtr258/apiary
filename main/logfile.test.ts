import {afterAll, describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {logRenderer, startFileLogging} from "./logfile.ts";

// startFileLogging wraps the global console; restore the natives afterwards so
// the patch does not leak into other test files (bun runs them in one process).
const nativeConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};
afterAll(() => {
  Object.assign(console, nativeConsole);
});

function tempLogPath(): {dir: string, file: string} {
  const dir = mkdtempSync(path.join(tmpdir(), "apiary-logtest-"));
  return {dir, file: path.join(dir, "apiary.log")};
}

function cleanup(dir: string): void {
  rmSync(dir, {recursive: true, force: true});
}

describe("startFileLogging", () => {
  test("creates the file and mirrors console output into it", () => {
    const {dir, file} = tempLogPath();
    startFileLogging(file);
    console.log("hello", 42);
    console.warn("careful");
    console.error("boom");
    const content = readFileSync(file, "utf8");
    expect(content).toContain("[main] [log] hello 42");
    expect(content).toContain("[main] [warn] careful");
    expect(content).toContain("[main] [error] boom");
    expect(content).toContain("[main]");
    cleanup(dir);
  });

  test("truncates an existing file on start", () => {
    const {dir, file} = tempLogPath();
    writeFileSync(file, "stale session logs\n");
    startFileLogging(file);
    console.log("fresh");
    const content = readFileSync(file, "utf8");
    expect(content).not.toContain("stale");
    expect(content).toContain("fresh");
    cleanup(dir);
  });

  test("logs renderer messages with level and source location", () => {
    const {dir, file} = tempLogPath();
    startFileLogging(file);
    logRenderer("error", "unhandled rejection", "http://localhost:5173/app.ts", 17);
    const content = readFileSync(file, "utf8");
    expect(content).toContain("[renderer] [error] unhandled rejection (http://localhost:5173/app.ts:17)");
    cleanup(dir);
  });
});
