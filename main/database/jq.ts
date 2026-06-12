import type {JQRequest, JQResponse} from "@/types/models.ts";
import {jq} from "@/jq.ts";

export const EmptyRequest: JQRequest = {
  query: ".",
  json: `{
  "string": "string",
  "number": 42,
  "bool": true,
  "list": [1, 2, 3],
  "null": null
}`,
};

export async function sendJQ({json, query}: JQRequest): Promise<JQResponse> {
  return {response: await jq(json, query)};
}
