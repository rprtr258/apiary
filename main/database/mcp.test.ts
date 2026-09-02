import {describe, test, expect} from "bun:test";
import {MCPRequest, MCPTool} from "@/types.ts";
import {mapTools, listTools, callTool} from "./mcp.ts";

describe("mapTools", () => test.each([
  [
    "maps name, description, and inputSchema",
    [{name: "echo", description: "echoes", inputSchema: {type: "object", properties: {}}}],
    [{name: "echo", description: "echoes", inputSchema: {type: "object", properties: {}}}],
  ],
  [
    "defaults missing description to empty string",
    [{name: "t", inputSchema: {type: "string"}}],
    [{name: "t", description: "", inputSchema: {type: "string"}}],
  ],
  [
    "defaults missing inputSchema to a permissive object schema",
    [{name: "t", description: "d"}],
    [{name: "t", description: "d", inputSchema: {type: "object", properties: {}}}],
  ],
] as [string, MCPTool[], MCPTool[]][])("%s", (_name, input, output) =>
  expect(mapTools(input)).toEqual(output)));

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
    expect(tools).toEqual([{name: "echo", description: "echoes the message", inputSchema: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {msg: {type: "string"}},
      required: ["msg"],
    }}]);
  }, 15000);
});

describe("callTool", () => {
  test("invokes a tool and returns the result", async () => {
    const result = await callTool(stdioReq, "echo", {msg: "hi"});
    expect(result).toEqual({content: [{type: "text", text: "echo: hi"}]});
  }, 15000);
});
