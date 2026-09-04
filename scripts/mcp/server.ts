/**
 * Sample MCP server for testing apiary's MCP request kind.
 *
 * Exposes a mix of MCP features (tools / resources / prompts) so apiary's
 * list + call paths can be exercised end to end. One binary, two transports
 * selected via the MCP_TRANSPORT env var:
 *
 *   - stdio (default): speak over stdin/stdout, e.g. `bun run server.ts`
 *   - http:            serve Streamable HTTP, e.g. `MCP_TRANSPORT=http bun run server.ts`
 *
 * In apiary, create an MCP request and point it at:
 *   - stdio: command `bun`, args `["run", "<repo>/scripts/mcp/server.ts"]`
 *   - http:  url `http://localhost:3001/mcp`
 *
 * This is a test fixture only — it binds 0.0.0.0 in http mode and does no
 * host/origin validation. Do not ship it as a real server.
 */
import * as z from "zod/v4";
import {McpServer, ResourceTemplate, createMcpHandler} from "@modelcontextprotocol/server";
import {StdioServerTransport} from "@modelcontextprotocol/server/stdio";

const NAME = "apiary-sample-mcp";
const VERSION = "0.0.0";
const HTTP_PORT = Number(process.env.MCP_PORT ?? "3001");
const TRANSPORT = (() => {
  const e = process.env.MCP_TRANSPORT ?? "stdio";
  if (!["stdio", "http"].includes(e))
    throw new Error(`unknown MCP_TRANSPORT "${e}" (expected "stdio" | "http")`);
  return e as "stdio" | "http";
})();

// In-memory "database" so resource reads + tool calls share state within a
// connection. Fine for a sample; http mode rebuilds the server per request,
// so this state is per-request there.
type User = {
  id: number,
  name: string,
  role: "admin" | "user" | "guest",
  active: boolean,
};
const users: User[] = [
  {id: 1, name: "Alice", role: "admin", active: true},
  {id: 2, name: "Bob",   role: "user",  active: true},
  {id: 3, name: "Carol", role: "guest", active: false},
];

function buildServer(): McpServer {
  const server = new McpServer({
    name: NAME,
    version: VERSION,
  });

  // --- Tools: varied schemas + return shapes ---

  // 1. Simple string input → text output.
  server.registerTool("echo", {
    description: "Echo back the given message as text.",
    inputSchema: z.object({message: z.string().describe("The text to echo")}),
  }, async ({message}) => ({content: [{
    type: "text",
    text: message,
  }]}));

  // 2. Numbers → text result.
  server.registerTool("add", {
    description: "Add two numbers and return the sum as text.",
    inputSchema: z.object({
      a: z.number().describe("First addend"),
      b: z.number().describe("Second addend"),
    }),
  }, async ({a, b}) => ({content: [{
    type: "text",
    text: String(a + b),
  }]}));

  // 3. Object input with an optional field → structured JSON as text.
  server.registerTool("user_lookup", {
    description: "Look up a user by id. Set detailed=true for the full record.",
    inputSchema: z.object({
      id: z.number().int().describe("User id"),
      detailed: z.boolean().optional().describe("Return the full record instead of just the name"),
    }),
  }, async ({id, detailed}) => {
    const user = users.find(u => u.id === id);
    if (user === undefined) {
      return {content: [{type: "text", text: `no user with id ${id}`}], isError: true};
    }
    const body = detailed ?? false ? user : {name: user.name};
    return {content: [{type: "text", text: JSON.stringify(body)}]};
  });

  // 4. Optional fields with defaults + randomness.
  server.registerTool("roll_dice", {
    description: "Roll dice. Defaults to one 6-sided die.",
    inputSchema: z.object({
      sides: z.number().int().min(2).optional().describe("Sides per die (default 6)"),
      count: z.number().int().min(1).max(20).optional().describe("Number of dice (default 1)"),
    }),
  }, async ({sides, count}) => {
    const n = sides ?? 6;
    const k = count ?? 1;
    const rolls = Array.from({length: k}, () => Math.floor(Math.random() * n) + 1);
    return {content: [{type: "text", text: JSON.stringify({rolls, total: rolls.reduce((a, b) => a + b, 0)})}]};
  });

  // 5. Array input.
  server.registerTool("sum_list", {
    description: "Sum a list of numbers.",
    inputSchema: z.object({
      values: z.array(z.number()).describe("Numbers to sum"),
    }),
  }, async ({values}) => ({content: [{
    type: "text",
    text: String(values.reduce((a, b) => a + b, 0)),
  }]}));

  // 6. Enum input.
  server.registerTool( "choose", {
    description: "Pick a hardcoded response for an enum option.",
    inputSchema: z.object({
      option: z.enum(["a", "b", "c"]).describe("Which branch to take"),
    }),
  }, async ({option}) => ({content: [{
    type: "text",
    text: `you chose: ${option}`,
  }]}));

  // 7. No input, always errors — for testing apiary's error rendering.
  server.registerTool("fail", {
    description: "Always returns an error result. Used to test error handling.",
  }, async () => ({content: [{
    type: "text",
    text: "intentional failure",
  }], isError: true}));

  // --- Resources: direct + templated ---

  server.registerResource("info", "sample://info", {
    mimeType: "application/json",
    description: "Server name/version + user count.",
  }, async uri => ({contents: [{
    uri: uri.href,
    mimeType: "application/json",
    text: JSON.stringify({name: NAME, version: VERSION, users: users.length}),
  }]}));

  server.registerResource("echo",
    new ResourceTemplate("sample://echo/{text}", {list: undefined}),
    {description: "Echoes the {text} path segment back as the resource body."},
    async (uri, vars) => ({contents: [{uri: uri.href, mimeType: "text/plain", text: String(vars.text)}]}),
  );

  // --- Prompts ---

  server.registerPrompt("review-code", {
    title: "Code review",
    description: "Produce a prompt that asks for a review of the given code.",
    argsSchema: z.object({
      language: z.string().describe("Programming language"),
      code: z.string().describe("The code to review"),
    }),
  }, async ({language, code}) => ({
    messages: [{role: "user", content: {type: "text", text: `Review this ${language} code for quality and idioms:\n\n${code}`}}],
  }));

  server.registerPrompt("summarize", {
    description: "Produce a prompt that asks to summarize the given text.",
    argsSchema: z.object({text: z.string().describe("The text to summarize")}),
  }, async ({text}) => ({
    messages: [{role: "user", content: {type: "text", text: `Summarize the following:\n\n${text}`}}],
  }));

  return server;
}

switch (TRANSPORT) {
case "stdio": {
  const transport = new StdioServerTransport();
  await buildServer().connect(transport);
  console.error(`[${NAME}] serving over stdio`);
  break;
}
case "http": {
  const handler = createMcpHandler(buildServer);
  Bun.serve({
    port: HTTP_PORT,
    hostname: "0.0.0.0",
    fetch: req => handler.fetch(req),
  });
  console.error(`[${NAME}] listening on http://0.0.0.0:${HTTP_PORT}/mcp`);
  break;
}
}
