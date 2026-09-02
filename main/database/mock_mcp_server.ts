// Minimal in-process MCP stdio server used only by mcp.test.ts.
// Registers one "echo" tool and handles CallTool over stdio transport.
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

await server.connect(new StdioServerTransport());
