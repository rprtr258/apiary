import {createClient} from "redis";
import type {RedisRequest, RedisResponse} from "@/types.ts";
import {createClientPool} from "./connection_pool.ts";

export const EmptyRequest: RedisRequest = {
  dsn: "localhost:6379",
  query: "KEYS *",
};

const urlOf = (dsn: string): string => dsn.startsWith("redis://") ? dsn : `redis://${dsn}`;

function hexDigitValue(c: string): number | null {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 97 && code <= 102) return code - 87; // a-f
  if (code >= 65 && code <= 70) return code - 55; // A-F
  return null;
}

// Mirrors redis-cli's splitArgs: whitespace separates tokens, one token may
// join adjacent bare and quoted segments, double quotes process escapes
// (\n \r \t \b \a \xHH, unknown escape yields the escaped char), single
// quotes are literal.
function splitArgs(query: string): string[] {
  const args: string[] = [];
  let arg = "";
  // Token has begun; without it an empty quoted arg ("") would be dropped.
  let started = false;
  let i = 0;
  const pushArg = () => {
    args.push(arg);
    arg = "";
    started = false;
  };
  while (i < query.length) {
    const c = query[i];
    if (/\s/.test(c)) {
      if (started) pushArg();
      i++;
      continue;
    }
    started = true;
    if (c === "'") {
      const end = query.indexOf("'", i + 1);
      if (end === -1)
        throw new Error("unbalanced quotes in query");
      arg += query.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c === "\"") {
      i++;
      let closed = false;
      while (i < query.length) {
        const q = query[i];
        if (q === "\"") {
          closed = true;
          i++;
          break;
        }
        if (q !== "\\") {
          arg += q;
          i++;
          continue;
        }
        // A backslash must escape one more char; hitting the end here means
        // the quoted section never closes (closed stays false -> unbalanced).
        if (i + 1 >= query.length)
          break;
        const esc = query[i + 1];
        // Only a well-formed \xHH counts as a hex escape; otherwise redis-cli
        // falls back to emitting the escaped char itself (\xZZ -> xZZ).
        if (esc === "x") {
          const h1 = hexDigitValue(query[i + 2] ?? "");
          const h2 = hexDigitValue(query[i + 3] ?? "");
          if (h1 !== null && h2 !== null) {
            arg += String.fromCharCode(h1 * 16 + h2);
            i += 4;
            continue;
          }
        }
        switch (esc) {
          case "n": arg += "\n"; break;
          case "r": arg += "\r"; break;
          case "t": arg += "\t"; break;
          case "b": arg += "\b"; break;
          case "a": arg += "\x07"; break; // \a is BEL; JS has no \a escape
          default: arg += esc; break;
        }
        i += 2;
      }
      if (!closed)
        throw new Error("unbalanced quotes in query");
      continue;
    }
    arg += c;
    i++;
  }
  if (started)
    pushArg();
  return args;
}

const pool = createClientPool({
  keyOf: (url: string) => url,
  connect: async url => {
    // reconnectStrategy: false — a lost server must surface as an operation
    // error (which evicts the client) instead of parking commands in the
    // offline queue while the client retries forever in the background.
    const client = createClient({url, socket: {reconnectStrategy: false}});
    client.on("error", () => pool.evict(url, client)); // dropped connection: drop the client, next request reconnects
    await client.connect();
    return client;
  },
  close: async client => client.destroy(),
});

export async function send(request: RedisRequest): Promise<RedisResponse> {
  return await pool.run(urlOf(request.dsn), async client => {
    const args = splitArgs(request.query);
    if (args.length === 0)
      throw new Error("empty query");
    const result = await client.sendCommand(args);
    return {response: JSON.stringify(result)};
  });
}
