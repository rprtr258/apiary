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
  kind: "tool",
  name: string,
  description: string,
  inputSchema: JSONSchema,
};

// A prompt subitem: a named template with simple string arguments.
export type MCPPromptArgument = {
  name: string,
  description: string,
  required: boolean,
};

export type MCPPrompt = {
  kind: "prompt",
  name: string,
  description: string,
  arguments: MCPPromptArgument[],
};

export type MCPListItems = {
  tools: MCPTool[],
  prompts: MCPPrompt[],
};

// Parameters of the completion/complete request (prompt reference only;
// resource templates are not listed by apiary)
export type MCPCompleteParams = {
  ref: {type: "ref/prompt", name: string},
  argument: {name: string, value: string},
  context?: {arguments?: Record<string, string>},
};

export type MCPCompletion = {
  completion: {
    values: string[],
    total?: number,
    hasMore?: boolean,
  },
};
