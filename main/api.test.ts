import {describe, test, expect, mock, beforeEach} from "bun:test";
import * as t from "@/types.ts";
import {Duplicate} from "./api.ts";
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
      id: "orig",
      path: "itc-slon/prod",
      kind: "sql-source",
      dsn: "clickhouse://localhost:8123/itc_slon",
      database: "clickhouse",
    },
  },
};

describe("Duplicate", () => {
  beforeEach(() => {
    // Seed a v1 DB with one sql-source request whose Data carries the envelope
    // (id/path/kind) matching its own identity — the shape load()/update() produce.
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("duplicate's Data envelope points at its own id/path/kind, not the original's", async () => {
    const newID = await Duplicate("orig");
    expect(newID).not.toBe("orig");

    const db = await load();
    const dup = db[newID];
    expect(dup).toBeDefined();
    expect(dup.ID).toBe(newID);
    expect(dup.Path).toBe("itc-slon/prod (copy)");
    expect(dup.Kind).toBe(t.Kind.SQLSource);

    // The envelope inside Data must match the duplicate's own identity.
    const data = dup.Data as Record<string, unknown>;
    expect(data["id"]).toBe(newID);
    expect(data["path"]).toBe("itc-slon/prod (copy)");
    expect(data["kind"]).toBe(t.Kind.SQLSource);

    // Payload fields are copied from the original.
    expect(data["dsn"]).toBe("clickhouse://localhost:8123/itc_slon");
    expect(data["database"]).toBe("clickhouse");
  });

  test("does not mutate the original request", async () => {
    await Duplicate("orig");

    const db = await load();
    const orig = db["orig"];
    expect(orig).toBeDefined();
    expect(orig.Path).toBe("itc-slon/prod");
    const data = orig.Data as Record<string, unknown>;
    expect(data["id"]).toBe("orig");
    expect(data["path"]).toBe("itc-slon/prod");
  });

  test("throws when duplicating a non-existent request", async () => {
    expect(Duplicate("nope")).rejects.toThrow("nope");
  });
});
