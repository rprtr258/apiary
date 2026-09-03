import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {SSEClientTransport} from "@modelcontextprotocol/sdk/client/sse.js";
import {Agent} from "undici";
import type {Transport} from "@modelcontextprotocol/sdk/shared/transport.js";
import type {MCPRequest, MCPTool, JSONSchema} from "@/types.ts";

export const EmptyRequest: MCPRequest = {
  transport: "stdio",
  command: "bunx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  env: [],
};

// MCP servers are often run locally with self-signed or untrusted certs
// (missing intermediate / local issuer), which fails Node's default TLS
// verification with `unable to get local issuer certificate`. Apiary is a
// desktop client the user points at servers they control, so accept those.
// ponytail: trust-all dispatcher; add per-source CA pinning if a real trust boundary appears
const insecureAgent = new Agent({connect: {rejectUnauthorized: false}});

function headers(req: {headers: {key: string, value: string}[]}): Record<string, string> {
  return Object.fromEntries(req.headers.map(({key, value}) => [key, value]));
}

function buildTransport(req: MCPRequest): Transport {
  switch (req.transport) {
  case "stdio":
    return new StdioClientTransport({
      command: req.command,
      args: req.args,
      env: Object.fromEntries(req.env.map(({key, value}) => [key, value])),
      stderr: "pipe",
    });
  case "http":
    return new StreamableHTTPClientTransport(new URL(req.url), {
      requestInit: {headers: headers(req), dispatcher: insecureAgent} as RequestInit,
    });
  case "sse":
    return new SSEClientTransport(new URL(req.url), {
      requestInit: {headers: headers(req), dispatcher: insecureAgent} as RequestInit,
    });
  }
}

// ponytail: per-op reconnect; pool clients if latency matters
async function withClient<T>(req: MCPRequest, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({name: "apiary", version: "1.0.0"}, {capabilities: {
    elicitation: {
      form: {},
      url: {},
    },
    experimental: {},
    extensions: {},
    roots: {
      listChanged: true,
    },
    sampling: {},
    tasks: {},
  }});
  const transport = buildTransport(req);
  // Collect subprocess stderr so connection failures can surface a useful message.
  let stderr = "";
  if (transport instanceof StdioClientTransport) {
    const stream = transport.stderr;
    if (stream !== null) {
      stream.on("data", (chunk: Buffer) => {stderr += chunk.toString();});
    }
  }
  try {
    await client.connect(transport);
    return await fn(client);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // undici wraps the real failure (ECONNREFUSED, ENOTFOUND, TLS, ...) in
    // `TypeError: fetch failed` with the reason on .cause; surface it so
    // http/sse connection errors are actionable instead of opaque.
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : undefined;
    const parts = [msg];
    if (cause !== undefined && cause !== msg) {
      parts.push(`cause: ${cause}`);
    }
    if (stderr !== "") {
      parts.push(`stderr:\n${stderr}`);
    }
    throw parts.length > 1 ? new Error(parts.join("\n")) : e;
  } finally {
    await client.close();
  }
}

const permissive: JSONSchema = {type: "object", properties: {}};

export function mapTools(sdkTools: {name: string, description?: string, inputSchema?: unknown}[]): MCPTool[] {
  return sdkTools.map(tool => {
    const schema = tool.inputSchema;
    return {
      name: tool.name,
      description: tool.description ?? "",
      inputSchema: schema === undefined ? permissive : schema as JSONSchema,
    };
  });
}

export async function listTools(req: MCPRequest): Promise<MCPTool[]> {
  console.log("[mcp] listTools", req.transport);
  return await withClient(req, async (client) => {
    const {tools} = await client.listTools();
    return mapTools(tools);
  });
}

export async function callTool(req: MCPRequest, toolName: string, args: unknown): Promise<unknown> {
  console.log("[mcp] callTool", req.transport, toolName);
  return await withClient(req, async (client) => {
    return await client.callTool({ // TODO: is result always is content[] ? render nicely if so
      name: toolName,
      arguments: args as Record<string, unknown> | undefined,
    });
  });
}
