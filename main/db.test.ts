import {describe, test, expect, mock, expectTypeOf, beforeEach} from "bun:test";
import * as t from "@/types.ts";
import {type DB, type Request, generateID, load, create, createDraft, Delete, rename, update, serialized, setDBPath, flushSave} from "./db.ts";
import type v2 from "./db.v2.ts";

// Controllable mock: by default readFile succeeds with "{}"
// Set mockReadFileErr to throw ENOENT for a specific test
// Set mockFileContent to serve a seeded db.json body
let mockReadFileErr: Error | null = null;
let mockFileContent: string | null = null;
let mockMtimeMs = 1000;
const writeFile = mock(() => Promise.resolve());
// The mock lives at module scope, so call counts would otherwise accumulate
// across tests in file order (visible under --randomize); reset both per test.
// setDBPath also drops db.ts's in-memory state (cache + pending debounced
// write), so every test's load() re-reads the freshly seeded content.
beforeEach(() => {
  mockReadFileErr = null;
  mockFileContent = null;
  mockMtimeMs = 1000;
  writeFile.mockClear();
  setDBPath("db.json");
});
mock.module("fs/promises", () => ({
  readFile: () => {
    if (mockReadFileErr !== null) {
      return Promise.reject(mockReadFileErr);
    }
    return Promise.resolve(mockFileContent ?? `{}`);
  },
  writeFile,
  // Coherent with readFile: stat rejects exactly when readFile would
  stat: () => mockReadFileErr !== null
    ? Promise.reject(mockReadFileErr)
    : Promise.resolve({mtimeMs: mockMtimeMs}),
}));

function emptyDB(): DB {
  return {requests: {}, drafts: {}};
}

describe("generateID", () => {
  test("returns a non-empty string", () => {
    const id = generateID();
    expect(id).toBeTruthy();
    expectTypeOf<string>(id);
  });

  test("produces unique IDs", () => {
    const ids = new Set(Array.from({length: 100}, () => generateID()));
    expect(ids.size).toBe(100);
  });
});

describe("create", () => {
  test("creates an HTTP request and returns its ID", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.HTTP, "my-api/get-users", {
      url: "https://example.com/users",
      method: "GET",
      body: "",
      headers: [],
    });

    expect(id).toBeTruthy();
    expect(db.requests).toEqual({[id]: {
      ID: id,
      Kind: t.Kind.HTTP,
      Path: "my-api/get-users",
      Data: {
        url: "https://example.com/users",
        method: "GET",
        body: "",
        headers: [],
      },
    }});
    await flushSave();
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  test("creates a SQL request", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.SQL, "test-sql", {
      dsn: "postgres://localhost:5432/test",
      database: "postgres",
      query: "SELECT 1",
    });

    expect(db.requests).toEqual({[id]: {
      ID: id,
      Kind: t.Kind.SQL,
      Path: "test-sql",
      Data: {
        query: "SELECT 1",
        database: "postgres",
        dsn: "postgres://localhost:5432/test",
      },
    }});
  });

  test("creates multiple requests with different IDs", async () => {
    const db = emptyDB();
    const id1 = await create(db, t.Kind.HTTP, "req1", {url: "http://a", method: "GET", body: "", headers: []});
    const id2 = await create(db, t.Kind.HTTP, "req2", {url: "http://b", method: "POST", body: "", headers: []});
    const id3 = await create(db, t.Kind.HTTP, "req3", {url: "http://c", method: "PUT", body: "", headers: []});

    expect(new Set([id1, id2, id3]).size).toBe(3);
    expect(Object.keys(db.requests)).toHaveLength(3);
  });
});

describe("remove", () => {
  test("removes a request from the DB", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.HTTP, "test", {url: "http://x", method: "GET", body: "", headers: []});
    expect(Object.keys(db.requests)).toHaveLength(1);

    await Delete(db, id);
    expect(Object.keys(db.requests)).toHaveLength(0);
    expect(db.requests[id]).toBeUndefined();
  });

  test("removes response entries from the index", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.JQ, "test", {query: ".", json: "{}"});
    await Delete(db, id);
    expect(db.requests).not.toContainKey(id);
  });


  test("throws when removing non-existent request", () => {
    const db = emptyDB();
    expect(Delete(db, "nonexistent")).rejects.toThrow("nonexistent");
  });
});

describe("rename", () => {
  test("renames a request", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.HTTP, "old-name", {url: "http://x", method: "GET", body: "", headers: []});

    await rename(db, id, "new-name");
    expect(db.requests[id].Path).toBe("new-name");
  });

  test("throws when renaming to an existing path", async () => {
    const db = emptyDB();
    await create(db, t.Kind.HTTP, "existing", {url: "http://a", method: "GET", body: "", headers: []});
    const id = await create(db, t.Kind.HTTP, "other", {url: "http://b", method: "GET", body: "", headers: []});

    expect(rename(db, id, "existing")).rejects.toThrow("already exists");
  });

  test("throws when renaming non-existent request", () => {
    const db = emptyDB();
    expect(rename(db, "nonexistent", "new-name")).rejects.toThrow("nonexistent");
  });
});

describe("update", () => {
  test("updates request data", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.HTTP, "test", {url: "http://old", method: "GET", body: "", headers: []});

    const newData = {url: "http://new", method: "POST", body: "data", headers: [{key: "Content-Type", value: "text/plain"}]};
    await update(db, id, newData);
    expect(db.requests[id].Data).toEqual(newData);
  });

  test("throws when updating non-existent request", () => {
    const db = emptyDB();
    expect(update(db, "nonexistent", {} as Request["Data"])).rejects.toThrow("nonexistent");
  });
});

describe("load", () => {
  test("loads DB from JSON", async () => {
    const db = await load();
    // "{}" counts as an old version, so load() schedules a fire-and-forget
    // migration persist; chaining behind the queue waits for it to finish.
    await serialized(async () => {});
    expect(db).toBeTruthy();
  });

  test("if db.json does not exist, load() should create it", async () => {
    mockReadFileErr = Object.assign(new Error("ENOENT"), {code: "ENOENT"});

    writeFile.mockClear();
    try {
      const db = await load();
      expect(db).toEqual({requests: {}, drafts: {}});
      await flushSave();
      expect(writeFile).toHaveBeenCalled();
    } finally {
      mockReadFileErr = null;
      writeFile.mockClear();
    }
  });
});

describe("debounced save", () => {
  test("coalesces near-time mutations into one write", async () => {
    const db = emptyDB();
    const id1 = await create(db, t.Kind.HTTP, "a", {url: "http://a", method: "GET", body: "", headers: []});
    const id2 = await create(db, t.Kind.HTTP, "b", {url: "http://b", method: "GET", body: "", headers: []});
    await flushSave();

    expect(writeFile).toHaveBeenCalledTimes(1);
    const firstWrite = writeFile.mock.calls[0] as unknown as [string, string];
    const written = JSON.parse(firstWrite[1]) as {request: {id: string}[]};
    expect(written.request.map(r => r.id).sort()).toEqual([id1, id2].sort());
  });

  test("load() reuses in-memory state while a write is pending", async () => {
    const db = await load();
    const id = await create(db, t.Kind.HTTP, "pending", {url: "http://x", method: "GET", body: "", headers: []});
    expect(writeFile).not.toHaveBeenCalled();

    const again = await load();
    expect(again.requests[id]).toBeDefined();
  });

  test("load() cache-hits while the file is unchanged", async () => {
    const first = await load();
    const second = await load();
    expect(second).toBe(first);
  });

  test("load() re-reads db.json after an external rewrite", async () => {
    const first = await load();
    expect(Object.keys(first.requests)).toEqual([]);

    mockMtimeMs += 1;
    mockFileContent = JSON.stringify({
      request: [{id: "ext", kind: "http", path: "ext/req"}],
      http: {ext: {request: {url: "http://ext", method: "GET", body: "", headers: []}}},
    });
    const second = await load();
    expect(second).not.toBe(first);
    expect(second.requests["ext"].Path).toBe("ext/req");
  });

  test("external rewrite wins over pending unsaved state", async () => {
    const db = await load();
    await create(db, t.Kind.HTTP, "stale", {url: "http://s", method: "GET", body: "", headers: []});
    expect(writeFile).not.toHaveBeenCalled();

    mockMtimeMs += 1;
    mockFileContent = JSON.stringify({
      request: [{id: "ext", kind: "http", path: "ext/req"}],
      http: {ext: {request: {url: "http://ext", method: "GET", body: "", headers: []}}},
    });
    const fresh = await load();
    expect(fresh.requests["stale"]).toBeUndefined();
    expect(fresh.requests["ext"].Path).toBe("ext/req");

    // The stale write was dropped with the cache, it must never land
    await flushSave();
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("migration", () => {
  test("migrates a v1 db.json to the in-memory schema", async () => {
    mockFileContent = JSON.stringify({
      $version: 1,
      request: [
        {id: "h1", kind: "http", path: "api/get"},
        {id: "src1", kind: "sql-source", path: "mydb"},
      ],
      http: {h1: {
        request: {url: "https://example.com", method: "GET", body: "", headers: []},
      }},
      "sql-source": {src1: {database: "sqlite", dsn: "file:/tmp/x.db", readOnly: true}},
    });

    const db = await load();

    expect(db.requests["h1"]).toEqual({
      ID: "h1",
      Path: "api/get",
      Kind: t.Kind.HTTP,
      Data: {url: "https://example.com", method: "GET", body: "", headers: []},
    });
    expect(db.requests["src1"]).toEqual({
      ID: "src1",
      Path: "mydb",
      Kind: t.Kind.SQLSource,
      Data: {database: "sqlite", dsn: "file:/tmp/x.db", readOnly: true},
    });
  });

  test("migrating a v1 db.json does not rewrite the file", async () => {
    mockFileContent = JSON.stringify({$version: 1, request: []});

    await load();

    expect(writeFile).toHaveBeenCalledTimes(0);
  });

  test("does not rewrite an up-to-date db.json", async () => {
    mockFileContent = JSON.stringify({$version: 2, drafts: []});

    await load();

    expect(writeFile).not.toHaveBeenCalled();
  });

  test("treats a db.json without $version as v1", async () => {
    mockFileContent = JSON.stringify({});

    const db = await load();

    expect(db).toEqual({requests: {}, drafts: {}});
    expect(writeFile).toHaveBeenCalledTimes(0);
  });

  test("refuses a db.json written by a newer apiary", async () => {
    mockFileContent = JSON.stringify({$version: 3, requests: {}});

    expect(load()).rejects.toThrow("newer");
  });
});

describe("drafts", () => {
  const seed = {
    $version: 1,
    request: [{id: "r1", kind: "http", path: "plain"}],
    http: {r1: {request: {url: "http://x", method: "GET", body: "", headers: []}, responses: []}},
  };

  test("a v1 file without a drafts section loads with no drafts", async () => {
    mockFileContent = JSON.stringify(seed);
    const db = await load();
    expect(db.drafts).toEqual({});
  });

  test("load seeds draft numbers from the drafts section", async () => {
    mockFileContent = JSON.stringify({...seed, $version: 2, drafts: [{id: "r1", n: 4}]});
    const db = await load();
    expect(db.drafts).toEqual({r1: 4});
  });

  test("createDraft allocates increasing n and persists record + section", async () => {
    const db = emptyDB();
    const id1 = await createDraft(db, t.Kind.JQ, {query: ".", json: "{}"});
    const id2 = await createDraft(db, t.Kind.JQ, {query: ".", json: "{}"});

    expect(db.requests[id1].Path).toBe("draft 1");
    expect(db.requests[id2].Path).toBe("draft 2");
    expect(db.drafts).toEqual({[id1]: 1, [id2]: 2});
    await flushSave();
    const lastWrite = writeFile.mock.calls.at(-1) as unknown as [string, string];
    const raw = JSON.parse(lastWrite[1]) as v2;
    expect(raw.drafts).toEqual([{id: id1, n: 1}, {id: id2, n: 2}]);
  });

  test("Delete removes the section entry", async () => {
    const db = emptyDB();
    const id = await createDraft(db, t.Kind.JQ, {query: ".", json: "{}"});
    await Delete(db, id);

    expect(db.drafts).toEqual({});
    expect(db.requests[id]).toBeUndefined();
    await flushSave();
    const lastWrite = writeFile.mock.calls.at(-1) as unknown as [string, string];
    const raw = JSON.parse(lastWrite[1]) as v2;
    expect(raw.drafts).toEqual([]);
  });

  test("rename demotes a draft to a regular request", async () => {
    const db = emptyDB();
    const id = await createDraft(db, t.Kind.JQ, {query: ".", json: "{}"});
    await rename(db, id, "kept");

    expect(db.drafts).toEqual({});
    expect(db.requests[id].Path).toBe("kept");
  });
});
