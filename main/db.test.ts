import {describe, test, expect, mock, expectTypeOf, beforeEach} from "bun:test";
import * as t from "@/types.ts";
import {type DB, type Request, generateID, load, create, Delete, rename, update, createResponse, HistoryEntry, serialized} from "./db.ts";

// Controllable mock: by default readFile succeeds with "{}"
// Set mockReadFileErr to throw ENOENT for a specific test
// Set mockFileContent to the db.json body a test should see
let mockReadFileErr: Error | null = null;
let mockFileContent = "{}";
const writeFile = mock(() => Promise.resolve());
// The mock lives at module scope, so call counts would otherwise accumulate
// across tests in file order (visible under --randomize); reset both per test.
beforeEach(() => {
  mockReadFileErr = null;
  mockFileContent = "{}";
  writeFile.mockClear();
});
mock.module("fs/promises", () => ({
  readFile: () => {
    if (mockReadFileErr !== null) {
      return Promise.reject(mockReadFileErr);
    }
    return Promise.resolve(mockFileContent);
  },
  writeFile,
}));

function emptyDB(): DB {
  return {requests: {}};
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
      Responses: [],
    }});
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
      Responses: [],
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
    (db.requests[id] as Request & {Kind: t.Kind.JQ}).Responses.push({SentAt: new Date(), ReceivedAt: new Date(), Response: {response: ["{}"]}});
    expect(db.requests[id].Responses).toHaveLength(1);

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

describe("createResponse", () => {
  test("appends response to request history", async () => {
    const db = emptyDB();
    const id = await create(db, t.Kind.HTTP, "test", {url: "http://x", method: "GET", body: "", headers: []});

    const httpResp = {code: 200, body: "OK", headers: [{key: "x-foo", value: "bar"}]};
    await createResponse(db, id, {SentAt: new Date(), ReceivedAt: new Date(), Response: httpResp});
    expect(db.requests[id].Kind).toBe(t.Kind.HTTP);
    expect(db.requests[id].Responses).toHaveLength(1);
    expect(db.requests[id].Responses[0].Response).toEqual(httpResp);
    expect(db.requests[id].Responses[0].SentAt).toBeTruthy();
    expect(db.requests[id].Responses[0].ReceivedAt).toBeTruthy();
  });

  test("throws when creating response for non-existent request", () => {
    const db = emptyDB();
    expect(createResponse(db, "nonexistent", {} as HistoryEntry)).rejects.toThrow("nonexistent");
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
      expect(db).toEqual({requests: {}});
      expect(writeFile).toHaveBeenCalled();
    } finally {
      mockReadFileErr = null;
      writeFile.mockClear();
    }
  });
});

describe("migration", () => {
  // load() persists the migration fire-and-forget through the serialized
  // queue; chaining a no-op behind it waits until the persist is done.
  async function drainPersist(): Promise<void> {
    await serialized(async () => {});
  }

  test("migrates a v1 db.json to the in-memory schema, reviving dates", async () => {
    mockFileContent = JSON.stringify({
      $version: 1,
      request: [
        {id: "h1", kind: "http", path: "api/get"},
        {id: "src1", kind: "sql-source", path: "mydb"},
      ],
      http: {h1: {
        request: {url: "https://example.com", method: "GET", body: "", headers: []},
        responses: [{SentAt: "2026-01-01T00:00:00.000Z", ReceivedAt: "2026-01-01T00:00:01.000Z", Response: {code: 200, body: "ok", headers: []}}],
      }},
      "sql-source": {src1: {database: "sqlite", dsn: "file:/tmp/x.db", readOnly: true}},
    });

    const db = await load();
    await drainPersist();

    expect(db.requests["h1"]).toEqual({
      ID: "h1",
      Path: "api/get",
      Kind: t.Kind.HTTP,
      Data: {url: "https://example.com", method: "GET", body: "", headers: []},
      Responses: [{SentAt: new Date("2026-01-01T00:00:00.000Z"), ReceivedAt: new Date("2026-01-01T00:00:01.000Z"), Response: {code: 200, body: "ok", headers: []}}],
    });
    expect(db.requests["src1"]).toEqual({
      ID: "src1",
      Path: "mydb",
      Kind: t.Kind.SQLSource,
      Data: {database: "sqlite", dsn: "file:/tmp/x.db", readOnly: true},
      Responses: [],
    });
  });

  test("persists the migrated db with the new version", async () => {
    mockFileContent = JSON.stringify({$version: 1, request: []});

    await load();
    await drainPersist();

    expect(writeFile).toHaveBeenCalledTimes(0);
  });

  test("does not rewrite an up-to-date db.json", async () => {
    mockFileContent = JSON.stringify({$version: 1, requests: {}});

    await load();
    await drainPersist();

    expect(writeFile).not.toHaveBeenCalled();
  });

  test("treats a db.json without $version as v1", async () => {
    mockFileContent = JSON.stringify({});

    const db = await load();
    await drainPersist();

    expect(db).toEqual({requests: {}});
    expect(writeFile).toHaveBeenCalledTimes(0);
  });

  test("refuses a db.json written by a newer apiary", async () => {
    mockFileContent = JSON.stringify({$version: 3, requests: {}});

    expect(load()).rejects.toThrow("newer");
  });
});
