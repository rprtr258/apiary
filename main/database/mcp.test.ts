import {describe, test, expect} from "bun:test";
import {MCPRequest, MCPTool, MCPPrompt} from "@/types.ts";
import {mapTool, listTools, callTool, mapPrompt, listPrompts, callPrompt, complete} from "./mcp.ts";

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

const mockServerPath = import.meta.dir + "/mock_mcp_server.ts";
const stdioReq: MCPRequest = {
  transport: "stdio",
  command: process.execPath,
  args: [mockServerPath],
  env: [],
};

describe("listTools", () => {
  test("discovers tools from a stdio server", async () => {
    const tools = await listTools(stdioReq);
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
    const prompts = await listPrompts(stdioReq);
    expect(prompts).toEqual([{
      kind: "prompt",
      name: "greet",
      description: "greets a person",
      arguments: [{name: "name", description: "who to greet", required: true}],
    }]);
  }, 15000);
});

describe("callTool", () => {
  test("invokes a tool and returns the result", async () => {
    const result = await callTool(stdioReq, "echo", {msg: "hi"});
    expect(result).toEqual({content: [{type: "text", text: "echo: hi"}]});
  }, 15000);
});

describe("getPrompt", () => {
  test("reads a prompt with arguments", async () => {
    const result = await callPrompt(stdioReq, "greet", {name: "world"});
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
    });
    expect(result).toEqual({completion: {values: ["world", "wonderland"], total: 2, hasMore: false}});
  }, 15000);

  test("returns empty values for unknown arguments", async () => {
    const result = await complete(stdioReq, {
      ref: {type: "ref/prompt", name: "greet"},
      argument: {name: "nope", value: ""},
    });
    expect(result).toEqual({completion: {values: [], hasMore: false}});
  }, 15000);
});
