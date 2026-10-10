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
  resources: MCPResource[],
};

// A resource subitem: an addressable data object exposed via resources/list.
export type MCPResource = {
  kind: "resource",
  uri: string,
  name: string,
  description: string,
  mimeType: string,
};

// One content entry of resources/read: text inline or blob as base64.
export type MCPResourceContents = {
  uri: string,
  mimeType: string,
  text: string,
  blob: string,
};

export type MCPReadResource = {
  contents: MCPResourceContents[],
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
