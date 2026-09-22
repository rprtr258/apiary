import {describe, test, expect, mock, beforeEach} from "bun:test";
import * as t from "@/types.ts";
import {Duplicate, resolveSQLRequest} from "./api.ts";
import {load} from "./db.ts";

// In-memory filesystem so load()/save() round-trip without touching disk.
// Bun runs each test file in its own module graph, so this mock is isolated from db.test.ts.
const files: Record<string, Buffer> = {};
mock.module("fs/promises", () => ({
  readFile: (path: string) =>
    path in files
      ? Promise.resolve(files[path])
      : Promise.reject(Object.assign(new Error("ENOENT"), {code: "ENOENT"})),
  writeFile: (path: string, data: Buffer) => {
    files[path] = data;
    return Promise.resolve();
  },
}));

const db_seed = {
  $version: 1,
  request: [{id: "orig", kind: "sql-source", path: "itc-slon/prod"}],
  http: {},
  sql: {},
  jq: {},
  md: {},
  redis: {},
  grpc: {},
  diff: {},
  "http-source": {},
  "sql-source": {
    orig: {
      dsn: "clickhouse://localhost:8123/itc_slon",
      database: "clickhouse",
    },
  },
};

describe("Duplicate", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("duplicate's Data is payload-only, no id/path/kind envelope", async () => {
    const newID = await Duplicate("orig");
    expect(newID).not.toBe("orig");

    const db = await load();
    const dup = db[newID];
    expect(dup).toBeDefined();
    expect(dup.ID).toBe(newID);
    expect(dup.Path).toBe("itc-slon/prod (copy)");
    expect(dup.Kind).toBe(t.Kind.SQLSource);

    // Payload fields are copied from the original.
    expect(dup.Data).toEqual({dsn: "clickhouse://localhost:8123/itc_slon", database: "clickhouse", readOnly: false});
  });

  test("does not mutate the original request", async () => {
    await Duplicate("orig");

    const db = await load();
    const orig = db["orig"];
    expect(orig).toBeDefined();
    expect(orig.Path).toBe("itc-slon/prod");
    // The original's Data is untouched by the duplicate.
    expect(orig.Data).toEqual({dsn: "clickhouse://localhost:8123/itc_slon", database: "clickhouse", readOnly: false});
  });

  test("throws when duplicating a non-existent request", async () => {
    expect(Duplicate("nope")).rejects.toThrow("nope");
  });
});

describe("resolveSQLRequest", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("resolves a dsn holding a SQLSource id to the source's dsn", async () => {
    const j = await load();
    const data: t.SQLRequest = {dsn: "orig", database: "clickhouse", query: "SELECT 1"};
    expect(resolveSQLRequest(j, data)).toEqual("clickhouse://localhost:8123/itc_slon");
  });

  test("uses a custom dsn as-is", async () => {
    const j = await load();
    const data: t.SQLRequest = {dsn: "postgres://localhost:5432/db", database: "postgres", query: "SELECT 1"};
    expect(resolveSQLRequest(j, data)).toEqual(data.dsn);
  });
});
