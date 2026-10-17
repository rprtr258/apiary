import {describe, test, expect, mock, expectTypeOf, beforeEach} from "bun:test";
import * as t from "@/types.ts";
import {type DB, type Request, generateID, load, create, createDraft, Delete, rename, update, createResponse, HistoryEntry} from "./db.ts";

// Shape of db.json as saved by main/db.ts, limited to the sections these tests assert on.
type rawDB = {
  drafts: {id: t.RequestID, n: number}[],
};

// Controllable mock: by default readFile succeeds with "{}"
// Set mockReadFileErr to throw ENOENT for a specific test
// Set mockFileContent to serve a seeded db.json body
let mockReadFileErr: Error | null = null;
let mockFileContent: string | null = null;
const writeFile = mock(() => Promise.resolve());
// The mock lives at module scope, so call counts would otherwise accumulate
// across tests in file order (visible under --randomize); reset both per test.
beforeEach(() => {
  mockReadFileErr = null;
  mockFileContent = null;
  writeFile.mockClear();
});
mock.module("fs/promises", () => ({
  readFile: () => {
    if (mockReadFileErr !== null) {
      return Promise.reject(mockReadFileErr);
    }
    return Promise.resolve(mockFileContent ?? `{}`);
  },
  writeFile,
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
    expect(db).toBeTruthy();
  });

  test("if db.json does not exist, load() should create it", async () => {
    mockReadFileErr = Object.assign(new Error("ENOENT"), {code: "ENOENT"});

    writeFile.mockClear();
    try {
      const db = await load();
      expect(db).toEqual({requests: {}, drafts: {}});
      expect(writeFile).toHaveBeenCalled();
    } finally {
      mockReadFileErr = null;
      writeFile.mockClear();
    }
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
    mockFileContent = JSON.stringify({...seed, drafts: [{id: "r1", n: 4}]});
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
    const lastWrite = writeFile.mock.calls.at(-1) as unknown as [string, string];
    const raw = JSON.parse(lastWrite[1]) as rawDB;
    expect(raw.drafts).toEqual([{id: id1, n: 1}, {id: id2, n: 2}]);
  });

  test("Delete removes the section entry", async () => {
    const db = emptyDB();
    const id = await createDraft(db, t.Kind.JQ, {query: ".", json: "{}"});
    await Delete(db, id);

    expect(db.drafts).toEqual({});
    expect(db.requests[id]).toBeUndefined();
    const lastWrite = writeFile.mock.calls.at(-1) as unknown as [string, string];
    const raw = JSON.parse(lastWrite[1]) as rawDB;
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