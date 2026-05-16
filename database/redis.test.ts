import {describe, test, expect} from "bun:test";
import type {RedisRequest} from "../types/models.ts";
import {sendRedis} from "./redis.ts";

const redisDSN = process.env.REDIS_DSN ?? "redis://localhost:6379";

function req(query: string): RedisRequest {
  return {dsn: redisDSN, query};
}

describe("sendRedis", () => {
  test("PING returns PONG", async () => {
    const result = await sendRedis(req("PING"));
    expect(result.response).toContain("PONG");
  });

  test("SET and GET a key", async () => {
    await sendRedis(req("SET test:key hello"));
    const result = await sendRedis(req("GET test:key"));
    expect(result.response).toContain("hello");
  });

  test("KEYS returns array", async () => {
    const result = await sendRedis(req("KEYS *"));
    expect(typeof result.response).toBe("string");
  });
});
