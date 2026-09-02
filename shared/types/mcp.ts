import type {JSONSchema, KV} from "./shared.ts";

// Connection config only (like HTTPSourceRequest). Discriminated union on "transport".
export type MCPRequest = {
  transport: "stdio",
  command: string,
  args: string[],
  env: KV[],
} | {
  transport: "http",
  url: string,
  headers: KV[],
} | {
  transport: "sse",
  url: string,
  headers: KV[],
};

export type MCPTransport = MCPRequest["transport"];

// A tool subitem. inputSchema reuses JSONSchema from shared/types/shared.ts.
export type MCPTool = {
  name: string,
  description: string,
  inputSchema: JSONSchema,
};
