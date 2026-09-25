import {describe, test, expect, mock} from "bun:test";
import {existsSync} from "node:fs";
import path from "node:path";
import {commandFor, normalizeReply, parseRedisDsn} from "./redissql.ts";

describe("parseRedisDsn", () => {
  test("prepends redis:// to bare host:port", () => {
    expect(parseRedisDsn("localhost:6379")).toEqual({url: "redis://localhost:6379", db: 0});
  });

  test("parses db from url path", () => {
    expect(parseRedisDsn("redis://localhost:6379/2")).toEqual({url: "redis://localhost:6379/2", db: 2});
  });

  test("defaults to db 0 on missing or non-numeric path", () => {
    expect(parseRedisDsn("redis://localhost:6379")).toEqual({url: "redis://localhost:6379", db: 0});
    expect(parseRedisDsn("redis://localhost:6379/")).toEqual({url: "redis://localhost:6379/", db: 0});
    expect(parseRedisDsn("redis://localhost:6379/abc")).toEqual({url: "redis://localhost:6379/abc", db: 0});
  });
});

describe("commandFor", () => {
  test("maps bridge ops to redis commands", () => {
    expect(commandFor("scanType", [5, "*", 0, "hash"])).toEqual(["SCAN", "5", "MATCH", "*", "COUNT", "0", "TYPE", "hash"]);
    expect(commandFor("get", ["foo"])).toEqual(["GET", "foo"]);
    expect(commandFor("keys", ["*"])).toEqual(["KEYS", "*"]);
    expect(commandFor("type", ["foo"])).toEqual(["TYPE", "foo"]);
    expect(commandFor("expireTime", ["foo"])).toEqual(["EXPIRETIME", "foo"]);
    expect(commandFor("lLen", ["foo"])).toEqual(["LLEN", "foo"]);
    expect(commandFor("lIndex", ["foo", 3])).toEqual(["LINDEX", "foo", "3"]);
    expect(commandFor("sMembers", ["foo"])).toEqual(["SMEMBERS", "foo"]);
    expect(commandFor("hGetAll", ["foo"])).toEqual(["HGETALL", "foo"]);
    expect(commandFor("zRangeWithScores", ["foo", 0, -1])).toEqual(["ZRANGE", "foo", "0", "-1", "WITHSCORES"]);
  });

  test("throws on unknown op", () => {
    expect(() => commandFor("nope", [])).toThrow("unknown redis op: nope");
  });
});

describe("normalizeReply", () => {
  test("scanType splits cursor from keys", () => {
    expect(normalizeReply("scanType", ["7", ["a", "b"]])).toEqual({keys: ["a", "b"], cursor: 7});
  });

  test("hGetAll chunks flat RESP2 reply", () => {
    expect(normalizeReply("hGetAll", ["f1", "v1", "f2", "v2"])).toEqual({f1: "v1", f2: "v2"});
  });

  test("hGetAll passes through RESP3 map", () => {
    const reply = new Map([["f1", "v1"]]);
    expect(normalizeReply("hGetAll", reply)).toEqual({f1: "v1"});
  });

  test("zRangeWithScores pairs members with scores", () => {
    expect(normalizeReply("zRangeWithScores", ["a", "1.5", "b", "2"]))
      .toEqual([{member: "a", score: 1.5}, {member: "b", score: 2}]);
  });

  test("zRangeWithScores passes through empty and paired replies", () => {
    expect(normalizeReply("zRangeWithScores", [])).toEqual([]);
  });

  test("get passes value and null through", () => {
    expect(normalizeReply("get", "bar")).toEqual("bar");
    expect(normalizeReply("get", null)).toEqual(null);
  });
});

// End-to-end through the real wasm engine with a fake redis behind the
// "redis" module mock. Skipped when the artifact is not built.
const wasmPath = path.resolve(import.meta.dirname, "..", "dist-electron", "redissql.wasm");
const wasmExecPath = path.resolve(import.meta.dirname, "..", "dist-electron", "redissql-wasm-exec.js");

const strings: Record<string, string> = {foo: "bar", greeting: "hello world"};
const fakeClient = {
  connect: async () => fakeClient,
  sendCommand: async (args: string[]): Promise<unknown> => {
    switch (args[0]) {
      case "SCAN":
        return ["0", Object.keys(strings)];
      case "GET":
        return strings[args[1]] ?? null;
      default:
        throw new Error(`unexpected command: ${args[0]}`);
    }
  },
};

mock.module("redis", () => ({
  createClient: () => fakeClient,
}));

describe("querySqlOverRedis end-to-end", async () => {
  const {querySqlOverRedis} = await import("./redissql.ts");

  test("runs SQL against redis data", async () => {
    if (existsSync(wasmPath) === false || existsSync(wasmExecPath) === false) {
      console.warn("skipping redissql e2e: artifact missing, run bun run build:wasm");
      return;
    }

    const result = await querySqlOverRedis("localhost:6379", "SELECT * FROM rstring");
    expect(result.columns).toEqual(["key", "value", "string"]);
    expect(result.rows).toContainEqual(["foo", "bar", "bar"]);
    expect(result.rows).toContainEqual(["greeting", "hello world", "hello world"]);
  });

  test("rejects on SQL syntax errors", async () => {
    if (existsSync(wasmPath) === false || existsSync(wasmExecPath) === false) {
      return;
    }

    expect(querySqlOverRedis("localhost:6379", "SELEKT nope")).rejects.toThrow("syntax error");
  });

  test("pools clients per dsn", async () => {
    if (existsSync(wasmPath) === false) {
      return;
    }

    const {querySqlOverRedis: query} = await import("./redissql.ts");
    await query("localhost:6379", "SELECT * FROM rstring");
    await query("localhost:6379", "SELECT * FROM rstring"); // same client reused
  });
});
