import {describe, test, expect, afterAll} from "bun:test";
import type {RedisRequest} from "@/types.ts";
import * as redis from "../database/redis.ts";

const IS_INTEGRATION = Boolean(process.env["INTEGRATION"]);
const redisDSN = process.env["REDIS_DSN"] ?? "redis://localhost:6379";

function req(query: string): RedisRequest {
  return {dsn: redisDSN, query};
}

describe.if(IS_INTEGRATION)("redis.send", () => {
  test("PING returns PONG", async () => {
    const result = await redis.send(req("PING"));
    expect(result.response).toContain("PONG");
  });

  test("SET and GET a key", async () => {
    await redis.send(req("SET test:key hello"));
    const result = await redis.send(req("GET test:key"));
    expect(result.response).toContain("hello");
  });

  test("KEYS returns array", async () => {
    const result = await redis.send(req("KEYS *"));
    expect(typeof result.response).toBe("string");
  });

  afterAll(async () => {
    await redis.send(req("DEL test:quotes"));
  });

  // Command splitting (redis-cli-style quoting) verified by round-tripping a
  // value through the real server: SET parses the query, GET reads back what
  // was stored. result.response is JSON.stringify(reply), so JSON.parse
  // restores the exact stored value.
  test("strips double quotes around a value", async () => {
    await redis.send(req("SET test:quotes \"héllo\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("héllo");
  });

  test("keeps whitespace inside quoted multi-word value", async () => {
    await redis.send(req("SET test:quotes \"barabem barabum\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("barabem barabum");
  });

  test("takes single-quoted values literally", async () => {
    await redis.send(req("SET test:quotes 'a b\\nc'"));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("a b\\nc");
  });

  test("processes double-quote escapes", async () => {
    await redis.send(req("SET test:quotes \"a\\nb\\t\\rc:\\\\path \\\"q\\\" \\\\ \\x41\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("a\nb\t\rc:\\path \"q\" \\ A");
  });

  test("concatenates adjacent quoted and bare segments", async () => {
    await redis.send(req("SET test:quotes foo\"bar baz\"'!'"));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("foobar baz!");
  });

  test("keeps empty quoted argument", async () => {
    await redis.send(req("SET test:quotes \"\""));
    const result = await redis.send(req("GET test:quotes"));
    expect(JSON.parse(result.response)).toBe("");
  });

  test("rejects unbalanced quotes", async () => {
    await expect(redis.send(req("SET test:quotes \"unterminated"))).rejects.toThrow("unbalanced");
  });

  test("rejects double-quoted value ending in a bare backslash", async () => {
    await expect(redis.send(req("SET test:quotes \"abc\\\""))).rejects.toThrow("unbalanced");
  });

  test("rejects whitespace-only query", async () => {
    await expect(redis.send(req("   "))).rejects.toThrow("empty query");
  });
});
