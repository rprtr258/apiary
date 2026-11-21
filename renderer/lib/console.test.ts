import {afterAll, beforeEach, describe, expect, test} from "bun:test";
import {installStringifiedConsole} from "./console.ts";

// bun runs test files in one process: capture the real console before any
// patching and restore it afterwards.
const realConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

let captured: unknown[][] = [];
const shim = (...args: unknown[]): void => {
  captured.push(args);
};

beforeEach(() => {
  // Install captures console at install time, so the shims must be in place
  // before each install to act as the natives the wrapper delegates to.
  captured = [];
  console.log = shim;
  console.warn = shim;
  console.error = shim;
  console.info = shim;
  console.debug = shim;
  installStringifiedConsole();
});

afterAll(() => {
  // The install wraps the global console; restore it so the patch does not
  // leak into other test files (bun runs them in one process).
  Object.assign(console, realConsole);
});

describe("installStringifiedConsole", () => {
  test("joins strings with spaces", () => {
    console.log("FETCH", "api.Create", "arg1");
    expect(captured).toEqual([["FETCH api.Create arg1"]]);
  });

  test("keeps plain values readable", () => {
    console.log(42, true, null, undefined);
    expect(captured).toEqual([["42 true null undefined"]]);
  });

  test("serializes objects and arrays as JSON", () => {
    console.info({ok: true});
    console.debug([{a: 1}, 2]);
    expect(captured).toEqual([[`{"ok":true}`], [`[{"a":1},2]`]]);
  });

  test("renders errors with their stack", () => {
    console.error("fetch failed", new Error("boom"));
    expect(String(captured[0][0])).toContain("fetch failed");
    expect(String(captured[0][0])).toContain("boom");
  });

  test("does not throw on cyclic structures", () => {
    const cyclic: {self?: unknown} = {};
    cyclic.self = cyclic;
    console.warn("cyclic", cyclic);
    expect(captured).toEqual([["cyclic [object Object]"]]);
  });

  test("forwards an empty string when called with no arguments", () => {
    console.log();
    expect(captured).toEqual([[""]]);
  });
});
