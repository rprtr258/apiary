// Minimal in-process MCP stdio server used only by mcp.test.ts.
// Registers one "echo" tool, one "greet" prompt and one static resource.
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {completable} from "@modelcontextprotocol/sdk/server/completable.js";
import * as z from "zod/v4";

const server = new McpServer({name: "apiary-mock-mcp", version: "0.0.0"});

server.registerTool("echo", {
  description: "echoes the message",
  inputSchema: z.object({
    msg: z.string(),
  }),
}, async ({msg}) => ({
  content: [{
    type: "text",
    text: "echo: " + (typeof msg === "string" ? msg : JSON.stringify(msg)),
  }],
}));

server.registerPrompt("greet", {
  description: "greets a person",
  // Raw shape, not z.object(): the SDK's zod-compat mis-parses classic
  // ZodObject instances passed as prompt argsSchema (keyValidator._parse)
  argsSchema: {name: completable(z.string().describe("who to greet"),
    (value: string) => ["world", "wonderland"].filter(candidate => candidate.startsWith(value)))},
}, async ({name}) => ({
  messages: [{
    role: "user" as const,
    content: {type: "text", text: "Say hello to " + name},
  }],
}));

server.registerResource("greeting", "file:///greeting.txt", {
  description: "a static greeting",
  mimeType: "text/plain",
}, async uri => ({
  contents: [{
    uri: uri.href,
    mimeType: "text/plain",
    text: "Hello from the apiary mock MCP server",
  }],
}));

await server.connect(new StdioServerTransport());
