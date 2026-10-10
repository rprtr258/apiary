import {afterAll, beforeAll, describe, test, expect} from "bun:test";
import {MCPRequest, MCPTool, MCPPrompt, MCPResource} from "@/types.ts";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {mapTool, listTools, callTool, mapPrompt, listPrompts, callPrompt, complete, mapResource, listResources, readResource} from "./mcp.ts";

describe("mapTools", () => test.each([
  [
    "maps name, description, and inputSchema",
    {kind: "tool", name: "echo", description: "echoes", inputSchema: {type: "object", properties: {}}},
    {kind: "tool", name: "echo", description: "echoes", inputSchema: {type: "object", properties: {}}},
  ],
  [
    "defaults missing description to empty string",
    {kind: "tool", name: "t", inputSchema: {type: "string"}},
    {kind: "tool", name: "t", description: "", inputSchema: {type: "string"}},
  ],
  [
    "defaults missing inputSchema to a permissive object schema",
    {kind: "tool", name: "t", description: "d"},
    {kind: "tool", name: "t", description: "d", inputSchema: {type: "object", properties: {}}},
  ],
] as [string, MCPTool, MCPTool][])("%s", (_name, input, output) =>
  expect(mapTool(input)).toEqual(output)));

describe("mapPrompts", () => test.each([
  [
    "maps name, description, and arguments",
    {kind: "prompt", name: "greet", description: "greets", arguments: [{name: "who", description: "target", required: true}]},
    {kind: "prompt", name: "greet", description: "greets", arguments: [{name: "who", description: "target", required: true}]},
  ],
  [
    "defaults missing description and arguments",
    {kind: "prompt", name: "p"},
    {kind: "prompt", name: "p", description: "", arguments: []},
  ],
  [
    "defaults missing argument fields",
    {kind: "prompt", name: "p", arguments: [{name: "a"}]},
    {kind: "prompt", name: "p", description: "", arguments: [{name: "a", description: "", required: false}]},
  ],
] as [string, MCPPrompt, MCPPrompt][])("%s", (_name, input, output) =>
  expect(mapPrompt(input)).toEqual(output)));

describe("mapResources", () => test.each([
  [
    "maps uri, name, description, and mimeType",
    {kind: "resource", uri: "file:///r.txt", name: "r", description: "a resource", mimeType: "text/plain"},
    {kind: "resource", uri: "file:///r.txt", name: "r", description: "a resource", mimeType: "text/plain"},
  ],
  [
    "defaults missing description and mimeType",
    {kind: "resource", uri: "file:///r.txt", name: "r"},
    {kind: "resource", uri: "file:///r.txt", name: "r", description: "", mimeType: ""},
  ],
] as [string, MCPResource, MCPResource][])("%s", (_name, input, output) =>
  expect(mapResource(input)).toEqual(output)));

const mockServerPath = import.meta.dir + "/mock_mcp_server.ts";
const stdioReq: MCPRequest = {
  transport: "stdio",
  command: process.execPath,
  args: [mockServerPath],
  env: [],
};

// One shared subprocess+client for all server round-trip tests: spawning and
// connecting per test dominated the runtime (~70-86ms each). The shared client
// is passed as the trailing `client` argument, so mcp.ts skips transport
// setup/teardown per call; afterAll's close shuts the subprocess down.
const client: Client = new Client({name: "apiary-test", version: "1.0.0"}, {capabilities: {}});
beforeAll(async () => {
  const transport = new StdioClientTransport({command: process.execPath, args: [mockServerPath], env: {}});
  await client.connect(transport);
});
afterAll(async () => {
  await client.close();
});

describe("listTools", () => {
  test("discovers tools from a stdio server", async () => {
    const tools = await listTools(stdioReq, client);
    expect(tools).toEqual([{kind: "tool", name: "echo", description: "echoes the message", inputSchema: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {msg: {type: "string"}},
      required: ["msg"],
    }}]);
  }, 15000);
});

describe("listPrompts", () => {
  test("discovers prompts from a stdio server", async () => {
    const prompts = await listPrompts(stdioReq, client);
    expect(prompts).toEqual([{
      kind: "prompt",
      name: "greet",
      description: "greets a person",
      arguments: [{name: "name", description: "who to greet", required: true}],
    }]);
  }, 15000);
});

describe("listResources", () => {
  test("discovers resources from a stdio server", async () => {
    const resources = await listResources(stdioReq, client);
    expect(resources).toEqual([{
      kind: "resource",
      uri: "file:///greeting.txt",
      name: "greeting",
      description: "a static greeting",
      mimeType: "text/plain",
    }]);
  }, 15000);
});

describe("readResource", () => {
  test("reads resource contents from a stdio server", async () => {
    const result = await readResource(stdioReq, "file:///greeting.txt", client);
    expect(result).toEqual({contents: [{
      uri: "file:///greeting.txt",
      mimeType: "text/plain",
      text: "Hello from the apiary mock MCP server",
      blob: "",
    }]});
  }, 15000);
});

describe("callTool", () => {
  test("invokes a tool and returns the result", async () => {
    const result = await callTool(stdioReq, "echo", {msg: "hi"}, client);
    expect(result).toEqual({content: [{type: "text", text: "echo: hi"}]});
  }, 15000);
});

describe("callPrompt", () => {
  test("reads a prompt with arguments", async () => {
    const result = await callPrompt(stdioReq, "greet", {name: "world"}, client);
    expect(result).toEqual({messages: [
      {role: "user", content: {type: "text", text: "Say hello to world"}},
    ]});
  }, 15000);
});

describe("complete", () => {
  test("completes prompt arguments from a stdio server", async () => {
    const result = await complete(stdioReq, {
      ref: {type: "ref/prompt", name: "greet"},
      argument: {name: "name", value: "w"},
      context: {arguments: {}},
    }, client);
    expect(result).toEqual({completion: {values: ["world", "wonderland"], total: 2, hasMore: false}});
  }, 15000);

  test("returns empty values for unknown arguments", async () => {
    const result = await complete(stdioReq, {
      ref: {type: "ref/prompt", name: "greet"},
      argument: {name: "nope", value: ""},
    }, client);
    expect(result).toEqual({completion: {values: [], hasMore: false}});
  }, 15000);
});
