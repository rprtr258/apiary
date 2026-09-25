// SQL-over-redis for the main process: loads the Go engine compiled to
// webassembly (internal/redissql/wasm, built by scripts/build-wasm.ts into
// dist-electron/) and bridges its redis calls to node-redis clients, which
// are created per dsn and pooled.
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import {createClientPool} from "./database/connection_pool.ts";
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
  const normalized = dsn.startsWith("redis://") ? dsn : `redis://${dsn}`;
  const url = new URL(normalized);
  const rawDb = url.pathname.replace("/", "");
  const parsed = rawDb === "" ? 0 : Number.parseInt(rawDb, 10);
  return {url: normalized, db: Number.isNaN(parsed) ? 0 : parsed};
}

/** Map a bridge op to the raw redis command argv. */
export function commandFor(op: string, args: unknown[]): string[] {
  const key = args[0] as string;
  switch (op) {
    case "scanType": {
      const [cursor, pattern, count, keyType] = args as [number, string, number, string];
      // count <= 0 means "no hint": redis requires COUNT >= 1 and rejects
      // COUNT 0 with a syntax error, so the clause is omitted entirely.
      const argv = count > 0
        ? ["SCAN", String(cursor), "MATCH", pattern, "COUNT", String(count)]
        : ["SCAN", String(cursor), "MATCH", pattern];
      if (keyType === "") {
        return argv;
      }
      return [...argv, "TYPE", keyType];
    }
    case "type":
      return ["TYPE", key];
    case "expireTime":
      // PTTL instead of EXPIRETIME (added in Redis 7.4); PTTL works since 2.6.
      return ["PTTL", key];
    case "mGet":
      return ["MGET", ...(args[0] as string[])];
    case "lRange":
      return ["LRANGE", key, String(args[1]), String(args[2])];
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

/** One ZRANGE WITHSCORES pair in the shape the wasm engine expects. Finite
 * scores cross as json numbers; json has no infinity, so non-finite ones keep
 * the raw redis score string ("+inf"/"-inf") for strconv.ParseFloat on the
 * Go side. */
function zRangeElem([member, score]: [string, unknown]): {member: string, score: number | string} {
  const num = Number(score);
  return {member, score: Number.isFinite(num) ? num : String(score)};
}

/** Map a raw redis reply to the json shape the wasm engine expects. */
export function normalizeReply(op: string, reply: unknown): unknown {
  switch (op) {
    case "scanType": {
      const [cursor, keys] = reply as [number | string, string[]];
      return {keys, cursor: Number(cursor)};
    }
    case "expireTime": {
      // PTTL: ms until expiry, -1 no expire, -2 missing key; the wasm engine
      // wants ms with -1 meaning "no expire", so missing keys map to -1 too
      // (rkey must not emit a pre-epoch timestamp for them).
      const ms = Number(reply);
      return ms < 0 ? -1 : ms;
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
      // RESP2: flat [member, score, ...]; RESP3/node-redis: Map. Every shape
      // normalizes to {member, score} objects (zRangeElem), so raw pairs
      // would fail on the Go side.
      if (reply === null || (Array.isArray(reply) && reply.length === 0)) {
        return [];
      }
      if (reply instanceof Map) {
        return [...reply].map(zRangeElem);
      }
      if (!Array.isArray(reply)) {
        throw new Error(`unexpected ZRANGE reply: ${JSON.stringify(reply)}`);
      }
      if (Array.isArray(reply[0])) {
        return reply.map(zRangeElem);
      }
      const elems: {member: string, score: number | string}[] = [];
      for (let i = 0; i < reply.length; i += 2) {
        elems.push(zRangeElem([reply[i] as string, reply[i + 1]]));
      }
      return elems;
    }
    default:
      return reply;
  }
}

// Clients are pooled per redis:// url (so dsns differing only in a database
// path get separate clients) - connect dedup, idle close and self-healing on
// errors are the generic pool's job.
const pool = createClientPool<RedisClient, string>({
  keyOf: (url) => url,
  connect: async (url) => {
    // reconnectStrategy: false — a lost server must surface as an operation
    // error (which evicts the client) instead of parking commands in the
    // offline queue while the client retries forever in the background.
    const client = createClient({url, socket: {reconnectStrategy: false}});
    client.on("error", () => pool.evict(url, client)); // dropped connection: drop the client, next request reconnects
    await client.connect();
    return client;
  },
  close: async (client) => client.destroy(),
});

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
      if (!existsSync(wasmExec) || !existsSync(artifactPath("redissql.wasm"))) {
        throw new Error("redissql.wasm is not built; run: bun run build:wasm");
      }

      const g = globals();
      createRequire(import.meta.url)(wasmExec); // defines globalThis.Go

      const go = new g.Go();
      const bytes = await readFile(artifactPath("redissql.wasm"));
      const {instance} = await WebAssembly.instantiate(bytes, go.importObject);

      g.redisCall = async (dsn, op, argsJson) => {
        const args = JSON.parse(argsJson) as unknown[];
        const {url} = parseRedisDsn(dsn);
        const reply = await pool.run(url, (client) => client.sendCommand(commandFor(op, args)));
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
