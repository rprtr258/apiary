import {describe, test, expect, mock} from "bun:test";
import {raw} from "jq-wasm";
import {sendJQ} from "./jq.ts";
import type {JQRequest} from "../types/models.ts";

// Mock jq-wasm
mock.module("jq-wasm", () => ({
  raw: mock(async (_json: string, _query: string, _flags?: string[]) => {
    return {stdout: "3\n", stderr: "", exitCode: 0};
  }),
}));

function makeRequest(overrides?: Partial<JQRequest>): JQRequest {
  return {
    json: `{"a": 1, "b": 2}`,
    query: ".a",
    ...overrides,
  };
}

describe("sendJQ", () => {
  test("executes a simple query and returns results", async () => {
    const result = await sendJQ(makeRequest());
    expect(result.response).toEqual(["1"]);
  });

  test("throws on jq error", async () => {
    (raw as ReturnType<typeof mock>).mockImplementationOnce(
      async () => ({stdout: "", stderr: "parse error: Invalid numeric literal at line 1", exitCode: 1}),
    );

    expect(sendJQ(makeRequest({query: "..invalid.."}))).rejects.toThrow("jq error");
  });

  test("handles empty results", async () => {
    (raw as ReturnType<typeof mock>).mockImplementationOnce(
      async () => ({stdout: "", stderr: "", exitCode: 0}),
    );

    const result = await sendJQ(makeRequest({query: ".nonexistent"}));
    expect(result.response).toEqual(["null"]);
  });
});
