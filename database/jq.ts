import jqWasm from "jq-wasm";
import type {JQRequest, JQResponse} from "../types/models.ts";

export const JQEmptyRequest: JQRequest = {
	query: ".",
	json: `{
  "string": "string",
  "number": 42,
  "bool": true,
  "list": [1, 2, 3],
  "null": null
}`,
};

export async function sendJQ(request: JQRequest): Promise<JQResponse> {
  const result = await jqWasm.raw(request.json, request.query, ["-r"]);
  if (result.exitCode !== 0) {
    throw new Error(`jq error: ${result.stderr}`);
  }

  const lines = result.stdout
    .split("\n")
    .filter(line => line.length > 0);
  return {response: lines};
}
