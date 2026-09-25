// SQL-over-redis for the main process: loads the Go engine compiled to
// webassembly (internal/redissql/wasm, built by scripts/build-wasm.ts into
// dist-electron/) and bridges its redis calls to node-redis clients, which
// are created per dsn and pooled.
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {createClient} from "redis";

export type RedissqlResult = {
  columns: string[],
  typenames: string[],
  rows: unknown[][],
};

type RedisClient = ReturnType<typeof createClient>;

type GoWasm = {
  importObject: WebAssembly.Imports,
  run: (instance: WebAssembly.Instance) => Promise<void>,
};

type RedissqlGlobals = {
  Go: new () => GoWasm,
  redisCall: (dsn: string, op: string, argsJson: string) => Promise<string>,
  redissqlQuery: (dsn: string, db: number, query: string) => Promise<string>,
};

function globals(): RedissqlGlobals {
  return globalThis as unknown as RedissqlGlobals;
}

/** Normalize a dsn to a redis:// url and extract the logical db number. */
export function parseRedisDsn(dsn: string): {url: string, db: number} {
  const normalized = dsn.startsWith("redis://") === true ? dsn : `redis://${dsn}`;
  const url = new URL(normalized);
  const rawDb = url.pathname.replace("/", "");
  const parsed = rawDb === "" ? 0 : Number.parseInt(rawDb, 10);
  return {url: normalized, db: Number.isNaN(parsed) === true ? 0 : parsed};
}

/** Map a bridge op to the raw redis command argv. */
export function commandFor(op: string, args: unknown[]): string[] {
  const key = args[0] as string;
  switch (op) {
    case "scanType": {
      const [cursor, pattern, count, keyType] = args as [number, string, number, string];
      return ["SCAN", String(cursor), "MATCH", pattern, "COUNT", String(count), "TYPE", keyType];
    }
    case "keys":
      return ["KEYS", key];
    case "type":
      return ["TYPE", key];
    case "expireTime":
      return ["EXPIRETIME", key];
    case "get":
      return ["GET", key];
    case "lLen":
      return ["LLEN", key];
    case "lIndex":
      return ["LINDEX", key, String(args[1])];
    case "sMembers":
      return ["SMEMBERS", key];
    case "hGetAll":
      return ["HGETALL", key];
    case "zRangeWithScores":
      return ["ZRANGE", key, String(args[1]), String(args[2]), "WITHSCORES"];
    default:
      throw new Error(`unknown redis op: ${op}`);
  }
}

/** Map a raw redis reply to the json shape the wasm engine expects. */
export function normalizeReply(op: string, reply: unknown): unknown {
  switch (op) {
    case "scanType": {
      const [cursor, keys] = reply as [number | string, string[]];
      return {keys, cursor: Number(cursor)};
    }
    case "hGetAll": {
      // RESP2: flat [field, value, ...]; RESP3/node-redis: Map or object
      if (reply instanceof Map) {
        return Object.fromEntries(reply);
      }
      if (Array.isArray(reply)) {
        const fields: Record<string, string> = {};
        for (let i = 0; i < reply.length; i += 2) {
          fields[reply[i] as string] = reply[i + 1] as string;
        }
        return fields;
      }
      return reply;
    }
    case "zRangeWithScores": {
      if (Array.isArray(reply) === false) {
        throw new Error(`unexpected ZRANGE reply: ${JSON.stringify(reply)}`);
      }
      if (reply.length === 0 || Array.isArray(reply[0])) {
        return reply; // already [[member, score], ...] pairs
      }
      const elems: {member: string, score: number}[] = [];
      for (let i = 0; i < reply.length; i += 2) {
        elems.push({member: reply[i] as string, score: Number(reply[i + 1])});
      }
      return elems;
    }
    default:
      return reply;
  }
}

const clients = new Map<string, Promise<RedisClient>>();

function clientFor(dsn: string): Promise<RedisClient> {
  const {url} = parseRedisDsn(dsn);
  const existing = clients.get(url);
  if (existing !== undefined) {
    return existing;
  }
  const client = createClient({url});
  const connected = client.connect().then(() => client);
  clients.set(url, connected);
  connected.catch(() => {
    clients.delete(url); // allow a retry on the next query
  });
  return connected;
}

// Artifacts sit next to the bundled main.js in production; fall back to the
// repo dist-electron/ when running from source (tests, unbundled scripts).
function artifactPath(name: string): string {
  const bundled = path.join(import.meta.dirname, name);
  if (existsSync(bundled)) {
    return bundled;
  }
  return path.resolve(import.meta.dirname, "..", "dist-electron", name);
}

let loadPromise: Promise<RedissqlGlobals> | null = null;

function load(): Promise<RedissqlGlobals> {
  if (loadPromise !== null) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const wasmExec = artifactPath("redissql-wasm-exec.js");
      if (existsSync(wasmExec) === false || existsSync(artifactPath("redissql.wasm")) === false) {
        throw new Error("redissql.wasm is not built; run: bun run build:wasm");
      }

      const g = globals();
      createRequire(import.meta.url)(wasmExec); // defines globalThis.Go

      const go = new g.Go();
      const bytes = await readFile(artifactPath("redissql.wasm"));
      const {instance} = await WebAssembly.instantiate(bytes, go.importObject);

      g.redisCall = async (dsn, op, argsJson) => {
        const args = JSON.parse(argsJson) as unknown[];
        const client = await clientFor(dsn);
        const reply = await client.sendCommand(commandFor(op, args));
        return JSON.stringify(normalizeReply(op, reply));
      };

      go.run(instance).catch((err: unknown) => {
        loadPromise = null; // a crashed runtime is reloaded on the next query
        console.error("redissql wasm crashed:", err);
      });

      if (typeof g.redissqlQuery !== "function") {
        throw new Error("redissql.wasm did not export redissqlQuery");
      }
      return g;
    } catch (err) {
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

/** Run one MySQL-dialect SQL query against the redis instance at dsn. */
export async function querySqlOverRedis(dsn: string, query: string): Promise<RedissqlResult> {
  const g = await load();
  const {db} = parseRedisDsn(dsn);
  const raw = await g.redissqlQuery(dsn, db, query);
  return JSON.parse(raw) as RedissqlResult;
}
