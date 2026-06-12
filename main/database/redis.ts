import {createClient} from "redis";
import type {RedisRequest, RedisResponse} from "@/types/models.ts";

export const EmptyRequest: RedisRequest = {
  dsn: "localhost:6379",
  query: "KEYS *",
};

export async function sendRedis(request: RedisRequest): Promise<RedisResponse> {
  const client = createClient({
    url: request.dsn.startsWith("redis://") ? request.dsn : `redis://${request.dsn}`,
  });

  await client.connect();
  try {
    const args = request.query.split(/\s+/); // TODO: smarter splitting? e.g. SET key "barabem barabum"
    if (args.length === 0)
      throw new Error("empty query");
    const result = await client.sendCommand(args);
    return {response: JSON.stringify(result)};
  } finally {
    client.destroy(); // TODO: keep connections pool
  }
}
