// Minimal in-process MCP stdio server used only by mcp.test.ts.
// Registers one "echo" tool and one "greet" prompt, handles CallTool and
// GetPrompt over stdio transport.
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
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
  argsSchema: {name: z.string().describe("who to greet")},
}, async ({name}) => ({
  messages: [{
    role: "user" as const,
    content: {type: "text", text: "Say hello to " + name},
  }],
}));

await server.connect(new StdioServerTransport());
