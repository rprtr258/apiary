import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {SSEClientTransport} from "@modelcontextprotocol/sdk/client/sse.js";
import {Agent} from "undici";
import type {Transport} from "@modelcontextprotocol/sdk/shared/transport.js";
import type {MCPRequest, MCPTool, MCPPrompt, JSONSchema, JSONValue, MCPCompleteParams, MCPCompletion} from "@/types.ts";

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
// `existing` hands in an already-connected client (used by tests sharing one
// subprocess); the caller then owns its lifecycle, so no transport is built
// and the client is not closed here.
async function withClient<T>(req: MCPRequest, fn: (client: Client) => Promise<T>, existing?: Client): Promise<T> {
  if (existing !== undefined) 
    return await fn(existing);

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

export function mapTool(tool: {name: string, description?: string, inputSchema?: unknown}): MCPTool {
  const schema = tool.inputSchema;
  return {
    kind: "tool",
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: schema === undefined ? permissive : schema as JSONSchema,
  };
}

export async function listTools(req: MCPRequest, client?: Client): Promise<MCPTool[]> {
  return await withClient(req, async (client) => {
    // Servers may support only a subset of tools/prompts/resources; listing is
    // merged by ListItems, so an unsupported listing is just empty
    if (client.getServerCapabilities()?.tools === undefined)
      return [];
    const {tools} = await client.listTools();
    return tools.map(mapTool);
  }, client);
}

export function mapPrompt(prompt: {name: string, description?: string, arguments?: {name: string, description?: string, required?: boolean}[]}): MCPPrompt {
  return {
    kind: "prompt",
    name: prompt.name,
    description: prompt.description ?? "",
    arguments: (prompt.arguments ?? []).map(arg => ({
      name: arg.name,
      description: arg.description ?? "",
      required: arg.required ?? false,
    })),
  };
}

export async function listPrompts(req: MCPRequest, client?: Client): Promise<MCPPrompt[]> {
  return await withClient(req, async (client) => {
    if (client.getServerCapabilities()?.prompts === undefined)
      return [];
    const {prompts} = await client.listPrompts();
    return prompts.map(mapPrompt);
  }, client);
}

export async function callTool(req: MCPRequest, toolName: string, args: JSONValue, client?: Client): Promise<unknown> {
  return await withClient(req, async (client) => {
    return await client.callTool({ // TODO: is result always is content[] ? render nicely if so
      name: toolName,
      arguments: args as Record<string, unknown> | undefined,
    });
  }, client);
}

export async function callPrompt(req: MCPRequest, promptName: string, args: JSONValue, client?: Client): Promise<unknown> {
  return await withClient(req, async (client) => {
    return await client.getPrompt({
      name: promptName,
      arguments: args as Record<string, string> | undefined,
    });
  }, client);
}

export async function complete(req: MCPRequest, params: MCPCompleteParams, client?: Client): Promise<MCPCompletion> {
  console.log("[mcp] complete", req.transport, params.ref.name, params.argument.name);
  return await withClient(req, async (client) => {
    // A server without the capability would error; empty is the protocol's
    // "no suggestions"
    if (client.getServerCapabilities()?.completions === undefined)
      return {completion: {values: []}};
    return await client.complete(params);
  }, client);
}
