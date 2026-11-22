import {describe, test, expect, mock} from "bun:test";
import {raw} from "jq-wasm";
import {send} from "./jq.ts";
import {JQRequest} from "@/types.ts";

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
    const result = await send(makeRequest());
    expect(result.response).toEqual(["1"]);
  });

  test("throws on jq error", async () => {
    (raw as ReturnType<typeof mock>).mockImplementationOnce(
      async () => ({stdout: "", stderr: "parse error: Invalid numeric literal at line 1", exitCode: 1}),
    );

    await expect(send(makeRequest({query: "..invalid.."}))).rejects.toThrow("jq error");
  });

  test("handles empty results", async () => {
    (raw as ReturnType<typeof mock>).mockImplementationOnce(
      async () => ({stdout: "", stderr: "", exitCode: 0}),
    );

    const result = await send(makeRequest({query: ".nonexistent"}));
    expect(result.response).toEqual(["null"]);
  });

  test("transforms every document of a JSONL stream", async () => {
    const result = await send(makeRequest({json: "{\"a\": 1}\n{\"a\": 2}"}));
    expect(result.response).toEqual(["1", "2"]);
  });

  test("rejects on invalid json body", async () => {
    await expect(send(makeRequest({json: "not json"}))).rejects.toThrow("jq error");
  });
});
