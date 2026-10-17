import {describe, test, expect, mock, beforeEach} from "bun:test";
import * as t from "@/types.ts";
import {CreateDraft, Delete, Duplicate, HTTPSource, List, Rename, resolveSQLRequest} from "./api.ts";
import {load, setDBPath, flushSave} from "./db.ts";
import type v2 from "./db.v2.ts";

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
  stat: () => Promise.resolve({mtimeMs: 1000}),
}));

// db.ts keeps loaded state in memory between debounced writes; reset it so
// each test's re-seeded db.json is actually re-read.
beforeEach(() => {
  setDBPath("db.json");
});

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
    const dup = db.requests[newID];
    expect(dup).toBeDefined();
    expect(dup.ID).toBe(newID);
    expect(dup.Path).toBe("itc-slon/prod (copy)");
    expect(dup.Kind).toBe(t.Kind.SQLSource);

    expect(dup.Data).toEqual({dsn: "clickhouse://localhost:8123/itc_slon", database: "clickhouse", readOnly: false});
  });

  test("does not mutate the original request", async () => {
    await Duplicate("orig");

    const db = await load();
    const orig = db.requests["orig"];
    expect(orig).toBeDefined();
    expect(orig.Path).toBe("itc-slon/prod");
    expect(orig.Data).toEqual({dsn: "clickhouse://localhost:8123/itc_slon", database: "clickhouse", readOnly: false});
  });

  test("throws when duplicating a non-existent request", async () => {
    expect(Duplicate("nope")).rejects.toThrow("nope");
  });
});

describe("HTTPSource.GenerateExampleRequest", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify({
      ...db_seed,
      request: [{id: "src", kind: "http-source", path: "src"}],
      "http-source": {
        src: {
          serverUrl: "https://api.example.com",
          specSource: "file",
          specData: JSON.stringify({
            openapi: "3.0.0",
            info: {title: "t", version: "0"},
            paths: {"/pets": {get: {responses: {}}}},
          }),
          auth: {type: "none"},
        },
      },
    }));
  });

  test("throws for endpoint missing from the schema", () => {
    expect(HTTPSource.GenerateExampleRequest("src", {method: "POST", path: "/nope"}))
      .rejects.toThrow("POST /nope");
  });

  test("generates example for endpoint found by method and path", async () => {
    const example = await HTTPSource.GenerateExampleRequest("src", {method: "GET", path: "/pets"});
    expect(example.method).toBe("GET");
    expect(example.url).toBe("https://api.example.com/pets");
  });
});

describe("resolveSQLRequest", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("resolves a dsn holding a SQLSource id to the source's dsn", async () => {
    const j = await load();
    const data: t.SQLRequest = {dsn: "orig", database: "clickhouse", query: "SELECT 1"};
    expect(resolveSQLRequest(j.requests, data)).toEqual("clickhouse://localhost:8123/itc_slon");
  });

  test("uses a custom dsn as-is", async () => {
    const j = await load();
    const data: t.SQLRequest = {dsn: "postgres://localhost:5432/db", database: "postgres", query: "SELECT 1"};
    expect(resolveSQLRequest(j.requests, data)).toEqual(data.dsn);
  });
});

describe("CreateDraft", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("allocates increasing n and writes record + section", async () => {
    const id1 = await CreateDraft(t.Kind.JQ);
    const id2 = await CreateDraft(t.Kind.JQ);
    await flushSave();

    const raw = JSON.parse(files["db.json"].toString()) as v2;
    expect(raw.drafts).toEqual([{id: id1, n: 1}, {id: id2, n: 2}]);

    const db = await load();
    expect(db.requests[id1].Path).toBe("draft 1");
    expect(db.requests[id2].Path).toBe("draft 2");
    expect(db.requests[id1].Kind).toBe(t.Kind.JQ);
  });

  test("reuses n after the highest-numbered draft is deleted", async () => {
    const id1 = await CreateDraft(t.Kind.DIFF);
    const id2 = await CreateDraft(t.Kind.DIFF);
    await Delete(id2);
    const id3 = await CreateDraft(t.Kind.DIFF);
    await flushSave();

    const raw = JSON.parse(files["db.json"].toString()) as v2;
    expect(raw.drafts).toEqual([{id: id1, n: 1}, {id: id3, n: 2}]);
  });

  test("concurrent creations serialize: no lost record, no duplicated draft number", async () => {
    const [id1, id2] = await Promise.all([CreateDraft(t.Kind.JQ), CreateDraft(t.Kind.JQ)]);

    expect(id1).not.toBe(id2);
    const db = await load();
    expect(db.requests[id1]).toBeDefined();
    expect(db.requests[id2]).toBeDefined();
    expect(db.drafts[id1]).toBe(1);
    expect(db.drafts[id2]).toBe(2);
  });

  test("defaults data to the kind's empty request", async () => {
    const id = await CreateDraft(t.Kind.DIFF);
    const db = await load();
    expect(db.requests[id].Data).toEqual({left: "", right: ""});
  });

  test("uses provided data", async () => {
    const data: t.JQRequest = {query: ".x", json: "{}"};
    const id = await CreateDraft(t.Kind.JQ, data);
    const db = await load();
    expect(db.requests[id].Data).toEqual(data);
  });

  test("rejects non-performable kinds", async () => {
    expect(CreateDraft(t.Kind.SQLSource)).rejects.toThrow("cannot be a draft");
    expect(CreateDraft(t.Kind.HTTPSource)).rejects.toThrow("cannot be a draft");
    expect(CreateDraft(t.Kind.MCP)).rejects.toThrow("cannot be a draft");
  });
});

describe("draft lifecycle", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("Delete removes the record and the section entry", async () => {
    const id = await CreateDraft(t.Kind.JQ);
    await Delete(id);
    await flushSave();

    const raw = JSON.parse(files["db.json"].toString()) as v2;
    expect(raw.drafts).toEqual([]);
    expect(raw.request!.find((r) => r.id === id)).toBeUndefined();
  });

  test("Rename of a draft demotes it to a regular request", async () => {
    const id = await CreateDraft(t.Kind.JQ);
    await Rename(id, "kept/saved");
    await flushSave();

    const raw = JSON.parse(files["db.json"].toString()) as v2;
    expect(raw.drafts).toEqual([]);
    const db = await load();
    expect(db.requests[id].Path).toBe("kept/saved");
  });
});

describe("List with drafts", () => {
  beforeEach(() => {
    files["db.json"] = Buffer.from(JSON.stringify(db_seed));
  });

  test("excludes drafts from Tree and returns them in the Drafts map", async () => {
    const draftID = await CreateDraft(t.Kind.JQ);
    const res = await List();

    expect(res.Drafts).toEqual({[draftID]: 1});
    expect(res.Requests[draftID].path).toBe("draft 1");
    expect(res.Tree.IDs).not.toContain(draftID);
    expect(res.Tree.Dirs["itc-slon"].IDs).toContain("orig");
    expect(res.Drafts["orig"]).toBeUndefined();
  });
});
