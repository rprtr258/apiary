import {createClient} from "redis";
import type {RedisRequest, RedisResponse} from "@/types.ts";
import {createClientPool} from "./connection_pool.ts";

export const EmptyRequest: RedisRequest = {
  dsn: "localhost:6379",
  query: "KEYS *",
};

const urlOf = (dsn: string): string => dsn.startsWith("redis://") ? dsn : `redis://${dsn}`;

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
    const args = request.query.split(/\s+/); // TODO: smarter splitting? e.g. SET key "barabem barabum"
    if (args.length === 0)
      throw new Error("empty query");
    const result = await client.sendCommand(args);
    return {response: JSON.stringify(result)};
  });
}
