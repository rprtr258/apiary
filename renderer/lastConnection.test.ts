import {describe, expect, test, beforeEach} from "bun:test";
import {Kind} from "@/types.ts";
import {lastConnectionSeed, recordLastConnection} from "./lastConnection.ts";

describe("lastConnection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("records and seeds only the connection fields of each kind", () => {
    recordLastConnection(Kind.HTTP, {url: "http://x", method: "GET", body: "", headers: []});
    recordLastConnection(Kind.SQL, {dsn: "pq://x", database: "postgres", query: "SELECT 1"});
    recordLastConnection(Kind.SQLSource, {database: "sqlite", dsn: ":memory:", readOnly: false});
    recordLastConnection(Kind.REDIS, {dsn: "r:6379", query: "KEYS *"});
    recordLastConnection(Kind.GRPC, {target: "t:1", method: "m", payload: "", metadata: []});
    recordLastConnection(Kind.HTTPSource, {serverUrl: "http://s", specSource: "url", specData: "", auth: {type: "none"}});

    expect(lastConnectionSeed(Kind.HTTP)).toEqual({url: "http://x"});
    expect(lastConnectionSeed(Kind.SQL)).toEqual({dsn: "pq://x", database: "postgres"});
    expect(lastConnectionSeed(Kind.SQLSource)).toEqual({dsn: ":memory:", database: "sqlite"});
    expect(lastConnectionSeed(Kind.REDIS)).toEqual({dsn: "r:6379"});
    expect(lastConnectionSeed(Kind.GRPC)).toEqual({target: "t:1"});
    expect(lastConnectionSeed(Kind.HTTPSource)).toEqual({serverUrl: "http://s"});
  });

  test("each kind tracks only its own fragment", () => {
    recordLastConnection(Kind.SQLSource, {database: "postgres", dsn: "pq://x", readOnly: true});
    expect(lastConnectionSeed(Kind.SQL)).toBeUndefined();

    recordLastConnection(Kind.SQL, {dsn: "pq://y", database: "sqlite", query: "SELECT 1"});
    expect(lastConnectionSeed(Kind.SQLSource)).toEqual({dsn: "pq://x", database: "postgres"});
    expect(lastConnectionSeed(Kind.SQL)).toEqual({dsn: "pq://y", database: "sqlite"});
  });

  test("kinds without connection fields are never recorded", () => {
    recordLastConnection(Kind.MD, {data: "# hi"});
    recordLastConnection(Kind.JQ, {query: ".", json: "{}"});
    recordLastConnection(Kind.DIFF, {left: "a", right: "b"});
    recordLastConnection(Kind.MCP, {transport: "stdio", command: "bunx", args: [], env: []});

    expect(localStorage.getItem("last-connection")).toBe(null);
  });

  test("missing or corrupted storage reads as no seed", () => {
    expect(lastConnectionSeed(Kind.HTTP)).toBeUndefined();

    localStorage.setItem("last-connection", "{not json");
    expect(lastConnectionSeed(Kind.HTTP)).toBeUndefined();
    // recording after corruption recovers with a fresh record
    recordLastConnection(Kind.HTTP, {url: "http://x", method: "GET", body: "", headers: []});
    expect(lastConnectionSeed(Kind.HTTP)).toEqual({url: "http://x"});
  });
});
