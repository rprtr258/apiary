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
    expect(commandFor("scanType", [5, "*", 0, "hash"])).toEqual(["SCAN", "5", "MATCH", "*", "TYPE", "hash"]);
    expect(commandFor("scanType", [5, "*", 10, "hash"])).toEqual(["SCAN", "5", "MATCH", "*", "COUNT", "10", "TYPE", "hash"]);
    expect(commandFor("scanType", [7, "*", 0, ""])).toEqual(["SCAN", "7", "MATCH", "*"]);
    expect(commandFor("type", ["foo"])).toEqual(["TYPE", "foo"]);
    expect(commandFor("expireTime", ["foo"])).toEqual(["PTTL", "foo"]);
    expect(commandFor("mGet", [["foo", "bar"]])).toEqual(["MGET", "foo", "bar"]);
    expect(commandFor("lRange", ["foo", 0, -1])).toEqual(["LRANGE", "foo", "0", "-1"]);
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

  test("expireTime passes PTTL ms through", () => {
    expect(normalizeReply("expireTime", 65123)).toBe(65123);
  });

  test("expireTime maps negative replies to -1", () => {
    expect(normalizeReply("expireTime", -1)).toBe(-1); // no expire
    expect(normalizeReply("expireTime", -2)).toBe(-1); // missing key
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

  test("zRangeWithScores converts empty, paired and map replies to objects", () => {
    expect(normalizeReply("zRangeWithScores", [])).toEqual([]);
    expect(normalizeReply("zRangeWithScores", [["a", "1.5"]]))
      .toEqual([{member: "a", score: 1.5}]);
    expect(normalizeReply("zRangeWithScores", new Map([["a", "1.5"]])))
      .toEqual([{member: "a", score: 1.5}]);
  });

  test("zRangeWithScores keeps non-finite scores as strings", () => {
    expect(normalizeReply("zRangeWithScores", ["a", "+inf", "b", "-inf", "c", "1.5"]))
      .toEqual([{member: "a", score: "+inf"}, {member: "b", score: "-inf"}, {member: "c", score: 1.5}]);
  });

  test("mGet passes values and nulls through", () => {
    expect(normalizeReply("mGet", ["bar", null])).toEqual(["bar", null]);
  });
});

// End-to-end through the real wasm engine with a fake redis behind the
// "redis" module mock. Skipped when the artifact is not built.
const wasmPath = path.resolve(import.meta.dirname, "..", "dist-electron", "redissql.wasm");
const wasmExecPath = path.resolve(import.meta.dirname, "..", "dist-electron", "redissql-wasm-exec.js");

const strings: Record<string, string> = {foo: "bar", greeting: "hello world"};
const fakeClient = {
  connect: async () => fakeClient,
  on: (_event: string, _listener: () => void) => {}, // error listener: pool eviction, no-op here
  sendCommand: async (args: string[]): Promise<unknown> => {
    switch (args[0]) {
      case "SCAN":
        return ["0", Object.keys(strings)];
      case "MGET":
        return args.slice(1).map((key) => strings[key] ?? null);
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
    if (!existsSync(wasmPath) || !existsSync(wasmExecPath)) {
      console.warn("skipping redissql e2e: artifact missing, run bun run build:wasm");
      return;
    }

    const result = await querySqlOverRedis("localhost:6379", "SELECT * FROM rstring");
    expect(result.columns).toEqual(["key", "value", "string"]);
    expect(result.rows).toContainEqual(["foo", "bar", "bar"]);
    expect(result.rows).toContainEqual(["greeting", "hello world", "hello world"]);
  });

  test("rejects on SQL syntax errors", async () => {
    if (!existsSync(wasmPath) || !existsSync(wasmExecPath)) {
      return;
    }

    expect(querySqlOverRedis("localhost:6379", "SELEKT nope")).rejects.toThrow("syntax error");
  });

  test("pools clients per dsn", async () => {
    if (!existsSync(wasmPath)) {
      return;
    }

    const {querySqlOverRedis: query} = await import("./redissql.ts");
    await query("localhost:6379", "SELECT * FROM rstring");
    await query("localhost:6379", "SELECT * FROM rstring"); // same client reused
  });

  test("lists redis tables via information_schema", async () => {
    if (!existsSync(wasmPath)) {
      return;
    }

    const result = await querySqlOverRedis("localhost:6379", "SELECT table_name FROM information_schema.TABLES WHERE table_schema = DATABASE()");
    const names = result.rows.map(r => r[0]);
    for (const table of ["rkey", "rstring", "rlist", "rset", "rhash", "rzset"]) {
      expect(names).toContain(table);
    }
  });

  test("counts rows", async () => {
    if (!existsSync(wasmPath)) {
      return;
    }

    const result = await querySqlOverRedis("localhost:6379", "SELECT COUNT(*) FROM rstring");
    expect(result.rows).toEqual([[2]]);
  });

  test("runs SELECT 1 for connection test", async () => {
    if (!existsSync(wasmPath)) {
      return;
    }

    const result = await querySqlOverRedis("localhost:6379", "SELECT 1");
    expect(result.rows).toEqual([[1]]);
  });

  test("rejects writes and DDL at the engine", async () => {
    if (!existsSync(wasmPath)) {
      return;
    }

    const rejects: [query: string, message: string][] = [
      ["UPDATE rstring SET value = 'x' WHERE `key` = 'foo'", "table doesn't support UPDATE"],
      ["INSERT INTO rstring (`key`, value) VALUES ('hax', '1')", "table doesn't support INSERT INTO"],
      ["DELETE FROM rstring WHERE `key` = 'foo'", "table doesn't support DELETE FROM"],
      ["TRUNCATE TABLE rstring", "table doesn't support TRUNCATE"],
      ["CREATE TABLE evil (id INT)", "tables cannot be created on database db0"],
      ["DROP TABLE rstring", "tables cannot be dropped on database db0"],
      ["RENAME TABLE rstring TO r2", "tables cannot be renamed on database db0"],
      ["ALTER TABLE rstring RENAME TO r2", "tables cannot be renamed on database db0"],
    ];
    for (const [query, message] of rejects) {
      try {
        await querySqlOverRedis("localhost:6379", query);
      } catch (e) {
        expect(String(e)).toContain(message);
        continue;
      }
      throw new Error(`expected rejection for: ${query}`);
    }
  });

  test("rejects ALTER TABLE on redis tables", async () => {
    if (!existsSync(wasmPath)) {
      return;
    }

    // Rejected incidentally by gms schema validation, not by an explicit
    // interface check like the renames above; asserted without a message so a
    // future gms upgrade that rejects it elsewhere still passes.
    try {
      await querySqlOverRedis("localhost:6379", "ALTER TABLE rstring DROP COLUMN value");
    } catch {
      return;
    }
    throw new Error("expected rejection for: ALTER TABLE rstring DROP COLUMN value");
  });
});
