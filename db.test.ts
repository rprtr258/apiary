import {describe, test, expect, mock, expectTypeOf} from "bun:test";
import {Kind, Database} from "./types/models.ts";
import {type DB, generateID, load, create, Delete, rename, update, createResponse} from "./db.ts";

// Mock writeFile to avoid touching disk
const writeFile = mock(() => Promise.resolve());
mock.module("fs/promises", () => ({
  readFile: () => Promise.resolve("{}"),
  writeFile,
}));

// Helper to create an empty DB
function emptyDB(): DB {
  return {};
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
    const id = await create(db, Kind.HTTP, "my-api/get-users", {
      url: "https://example.com/users",
      method: "GET",
      body: "",
      headers: [],
    });

    expect(id).toBeTruthy();
    expect(db).toEqual({[id]: {
      ID: id,
      Kind: Kind.HTTP,
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
    const id = await create(db, Kind.SQL, "test-sql", {
      dsn: "postgres://localhost:5432/test",
      database: Database.POSTGRES,
      query: "SELECT 1",
    });

    expect(db.request).toHaveLength(1);
    expect(db).toEqual({[id]: {
      ID: id,
      Kind: Kind.SQL,
      Path: "test-sql",
      Data: {
        query: "SELECT 1",
        database: Database.SQLITE,
        dsn: ":memory:",
      },
      Responses: [],
    }});
  });

  test("creates multiple requests with different IDs", async () => {
    const db = emptyDB();
    const id1 = await create(db, Kind.HTTP, "req1", {url: "http://a", method: "GET", body: "", headers: []});
    const id2 = await create(db, Kind.HTTP, "req2", {url: "http://b", method: "POST", body: "", headers: []});
    const id3 = await create(db, Kind.HTTP, "req3", {url: "http://c", method: "PUT", body: "", headers: []});

    expect(new Set([id1, id2, id3]).size).toBe(3);
    expect(db.request).toHaveLength(3);
  });
});

describe("remove", () => {
  test("removes a request from the DB", async () => {
    const db = emptyDB();
    const id = await create(db, Kind.HTTP, "test", {url: "http://x", method: "GET", body: "", headers: []});
    expect(db.request).toHaveLength(1);

    await Delete(db, id);
    expect(db.request).toHaveLength(0);
    expect(db[id]).toBeUndefined();
  });

  test("removes response entries from the index", async () => {
    const db = emptyDB();
    const id = await create(db, Kind.JQ, "test", {query: ".", json: "{}"});
    db[id].Responses.push({SentAt: "now", ReceivedAt: "now"});
    expect(db.response).toHaveLength(1);

    await Delete(db, id);
    expect(db.response).toHaveLength(0);
  });

  test("throws when removing non-existent request", () => {
    const db = emptyDB();
    expect(Delete(db, "nonexistent")).rejects.toThrow("nonexistent");
  });
});

describe("rename", () => {
  test("renames a request", async () => {
    const db = emptyDB();
    const id = await create(db, Kind.HTTP, "old-name", {url: "http://x", method: "GET", body: "", headers: []});

    await rename(db, id, "new-name");
    expect(db.request[0].path).toBe("new-name");
  });

  test("throws when renaming to an existing path", async () => {
    const db = emptyDB();
    await create(db, Kind.HTTP, "existing", {url: "http://a", method: "GET", body: "", headers: []});
    const id = await create(db, Kind.HTTP, "other", {url: "http://b", method: "GET", body: "", headers: []});

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
    const id = await create(db, Kind.HTTP, "test", {url: "http://old", method: "GET", body: "", headers: []});

    const newData = {url: "http://new", method: "POST", body: "data", headers: [{key: "Content-Type", value: "text/plain"}]};
    await update(db, id, Kind.HTTP, newData);
    expect(db[Kind.HTTP][id].request).toEqual(newData);
  });

  test("throws when updating non-existent request", () => {
    const db = emptyDB();
    expect(update(db, "nonexistent", Kind.HTTP, {})).rejects.toThrow("nonexistent");
  });
});

describe("createResponse", () => {
  test("appends response to request history", async () => {
    const db = emptyDB();
    const id = await create(db, Kind.HTTP, "test", {url: "http://x", method: "GET", body: "", headers: []});

    const httpResp = {code: 200, body: "OK", headers: [{key: "x-foo", value: "bar"}]};
    await createResponse(db, id, httpResp);
    expect(db[id].Kind).toBe(Kind.HTTP);
    expect(db[id].Responses).toHaveLength(1);
    expect(db[id].Responses[0].Response).toEqual(httpResp);
    expect(db[id].Responses[0].SentAt).toBeTruthy();
    expect(db[id].Responses[0].ReceivedAt).toBeTruthy();
  });

  test("throws when creating response for non-existent request", () => {
    const db = emptyDB();
    expect(createResponse(db, "nonexistent", {})).rejects.toThrow("nonexistent");
  });
});

describe("load", () => {
  test("loads DB from JSON", async () => {
    // readFile is mocked to return "{}" which is empty
    const db = await load();
    expect(db).toBeTruthy();
  });
});
