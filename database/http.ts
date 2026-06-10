import type {KV, HTTPRequest, HTTPResponse} from "../types/models.ts";

export const HTTPEmptyRequest: HTTPRequest = {
  url: "", // TODO: insert last url used
  method: "GET",
  body: "",
  headers: [],
};

export async function sendHTTP(request: HTTPRequest): Promise<HTTPResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: new Headers(request.headers.map(({key, value}): [string, string] => [key, value])),
    body: !["GET", "HEAD"].includes(request.method) ? request.body : undefined,
  });

  const body = await response.text();
  return {
    code: response.status,
    body,
    headers: Array.from(response.headers.entries().map(([key, value]): KV => ({key, value}))),
  };
}
