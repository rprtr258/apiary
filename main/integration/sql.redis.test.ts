import {describe, test, expect} from "bun:test";
import {existsSync} from "node:fs";
import path from "node:path";
import {SQLRequest, RedisRequest} from "@/types.ts";
import * as sql from "../database/sql.ts";
import * as redis from "../database/redis.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);
const redisDSN = process.env["REDIS_DSN"] ?? "redis://localhost:6379";

// redissql wasm artifact (built by bun run build:wasm); sql-over-redis tests
// skip when missing, mirroring main/redissql.test.ts
const wasmPath = path.resolve(import.meta.dirname, "..", "..", "dist-electron", "redissql.wasm");
const wasmExecPath = path.resolve(import.meta.dirname, "..", "..", "dist-electron", "redissql-wasm-exec.js");

function req(query: string): RedisRequest {
  return {dsn: redisDSN, query};
}

describe.if(IS_INTEGRATION)("sql.send (redis)", () => {
  function sqlReq(query: string): SQLRequest {
    return {dsn: redisDSN, database: "redis", query, readOnly: true};
  }

  test("zset scores of ±inf round-trip as strings", async () => {
    if (!existsSync(wasmPath) || !existsSync(wasmExecPath)) {
      console.warn("skipping sql-over-redis integration: artifact missing, run bun run build:wasm");
      return;
    }
    await redis.send(req("ZADD test:zinf +inf first -inf second"));
    try {
      const result = await sql.send(sqlReq("SELECT `rank`, score, value FROM rzset WHERE `key` = 'test:zinf' ORDER BY value"));
      // json has no infinity: scores cross the bridge as the redis score strings
      expect(result.rows).toEqual([[1, "+inf", "first"], [0, "-inf", "second"]]);
    } finally {
      await redis.send(req("DEL test:zinf"));
    }
  });
});

// The engine's query entry point takes no bound parameters, so a quote in a
// caller-supplied table name must reach it as a doubled-quote literal
// instead of breaking out of the information_schema string.
describe.if(IS_INTEGRATION)("sql crafted table names (redis)", () => {
  test("describeTable escapes quotes in the table name", async () => {
    if (!existsSync(wasmPath) || !existsSync(wasmExecPath)) {
      console.warn("skipping sql-over-redis integration: artifact missing, run bun run build:wasm");
      return;
    }
    // no such table: the escaped literal must parse (not error) and match nothing
    const schema = await sql.describeTable({dsn: redisDSN, database: "redis"}, "o'brien");
    expect(schema.columns).toEqual([]);
    // a real table still describes fully
    const real = await sql.describeTable({dsn: redisDSN, database: "redis"}, "rstring");
    expect(real.columns.map(c => c.name)).toEqual(["key", "value", "string"]);
  });
});
