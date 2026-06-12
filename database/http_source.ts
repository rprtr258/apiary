import type {HTTPSourceRequest, HTTPRequest, EndpointInfo, ParameterInfo, MediaTypeInfo, RequestBodyInfo, ResponseInfo, AuthConfig} from "../shared/types/models.ts";
import type {OpenAPIV2, OpenAPIV3, OpenAPIV3_1} from "openapi-types";
import {KV} from "../shared/types/models.ts";

type OpenAPIObject     = OpenAPIV2.Document           |   OpenAPIV3.Document          | OpenAPIV3_1.Document;
type PathItemObject    = OpenAPIV2.PathItemObject     |   OpenAPIV3.PathItemObject    | OpenAPIV3_1.PathItemObject;
type OperationObject   = OpenAPIV2.OperationObject    |   OpenAPIV3.OperationObject   | OpenAPIV3_1.OperationObject;
type ParameterObject   = OpenAPIV2.ParameterObject    |   OpenAPIV3.ParameterObject/* | OpenAPIV3_1.ParameterObject*/;
type SchemaObject      = OpenAPIV2.SchemaObject       |   OpenAPIV3.SchemaObject      | OpenAPIV3_1.SchemaObject;
type RequestBodyObject = /*OpenAPIV2.RequestBodyObject|*/ OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;
type MediaTypeObject   = /*OpenAPIV2.MediaTypeObject  |*/ OpenAPIV3.MediaTypeObject   | OpenAPIV3_1.MediaTypeObject;
type ResponsesObject   = /*OpenAPIV2.ResponsesObject  |*/ OpenAPIV3.ResponsesObject   | OpenAPIV3_1.ResponsesObject;
type ReferenceObject   =   OpenAPIV2.ReferenceObject  |   OpenAPIV3.ReferenceObject   | OpenAPIV3_1.ReferenceObject;

export async function fetchSpec(sourceRequest: HTTPSourceRequest): Promise<string> {
  switch (sourceRequest.specSource) {
  case "url":
    const url = sourceRequest.specData;
    const resp = await fetch(url);
    if (!resp.ok)
      throw new Error(`failed to fetch spec: ${resp.status}`);
    return await resp.text();
  case "file":
    // spec is inline in specData
    return sourceRequest.specData;
  }
}

export function parseSpec(specData: string): EndpointInfo[] {
  const spec = JSON.parse(specData) as OpenAPIObject;
  const endpoints: EndpointInfo[] = [];

  if (spec.paths === undefined)
    return endpoints;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const item = pathItem as PathItemObject | undefined;
    if (item === undefined)
      continue;

    const methods = ["get", "post", "put", "delete", "patch", "head", "options"] as const;
    for (const method of methods) {
      const operation = item[method] as OperationObject | undefined;
      if (operation === undefined)
        continue;

      const op = operation as OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
      endpoints.push({
        path,
        method: method.toUpperCase(),
        summary: operation.summary ?? operation.description ?? "",
        parameters: extractParameters(operation),
        requestBody: op.requestBody !== undefined ? extractRequestBody(op.requestBody) : undefined,
        responses: extractResponses(op.responses),
      });
    }
  }

  return endpoints;
}

export function generateExampleRequest(
  endpoint: EndpointInfo,
  serverURL: string,
  auth: AuthConfig,
): HTTPRequest {
  const authHeaders: KV[] = [];
  switch (auth.type) {
  case "none":
    break;
  case "basic":
    const {username, password} = auth;
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    authHeaders.push({key: "Authorization", value: authHeader});
    break;
  case "bearer":
    const {token} = auth;
    authHeaders.push({key: "Authorization", value: `Bearer ${token}`});
    break;
  case "apikey":
    const {key, value} = auth;
    authHeaders.push({key, value});
    break;
  case "oauth":
    // TODO: implement
    break;
  }

  const headers: KV[] = [];
  for (const param of endpoint.parameters) {
    if (param.in === "header") {
      headers.push({key: param.name, value: String(generateExampleValue(param.schema) ?? "")});
    }
  }
  headers.push({key: "Content-Type", value: "application/json"});

  let body = "";
  if (endpoint.requestBody !== undefined) {
    const mediaType = endpoint.requestBody.content["application/json"];
    body = JSON.stringify(generateExampleFromSchema(mediaType.schema), null, 2);
  }

  // Build URL with path params replaced
  let url = serverURL + endpoint.path;
  for (const param of endpoint.parameters) {
    if (param.in === "path") {
      url = url.replace(`{${param.name}}`, String(generateExampleValue(param.schema) ?? param.name));
    }
  }

  // Add query params
  const queryParams = endpoint.parameters.filter(p => p.in === "query");
  if (queryParams.length > 0) {
    const qs = queryParams
      .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(String(generateExampleValue(p.schema) ?? ""))}`)
      .join("&");
    url += `?${qs}`;
  }

  return {url, method: endpoint.method, body, headers};
}

function extractParameters(operation: OperationObject): ParameterInfo[] {
  return (operation.parameters as ParameterObject[] | undefined)?.map(p => ({
    name: p.name,
    in: p.in,
    description: p.description ?? "",
    required: p.required ?? false,
    schema: p.schema as (Record<string, unknown> | undefined) ?? {},
    example: undefined,
  })) ?? [];
}

function extractRequestBody(requestBody: RequestBodyObject | ReferenceObject): RequestBodyInfo {
  const body = "content" in requestBody ? requestBody : undefined;
  const content: Record<string, MediaTypeInfo> = {};
  if (body?.content !== undefined) {
    for (const [mediaType, mediaTypeObj] of Object.entries(body.content)) {
      content[mediaType] = {
        schema: (mediaTypeObj as MediaTypeObject).schema as (Record<string, unknown> | undefined) ?? {},
        example: undefined,
      };
    }
  }
  return {
    description: body?.description ?? "",
    required: body?.required ?? false,
    content,
  };
}

function extractResponses(responses: ResponsesObject | undefined): Record<string, ResponseInfo> {
  if (responses === undefined)
    return {};
  const result: Record<string, ResponseInfo> = {};
  for (const [code, response] of Object.entries(responses)) {
    const respObj = response as {description?: string, content?: Record<string, MediaTypeObject>};
    const content: Record<string, MediaTypeInfo> = {};
    if (respObj.content !== undefined) {
      for (const [mediaType, mediaTypeObj] of Object.entries(respObj.content)) {
        content[mediaType] = {
          schema: mediaTypeObj.schema as (Record<string, unknown> | undefined) ?? {},
          example: undefined,
        };
      }
    }
    result[code] = {
      description: respObj.description ?? "",
      content: Object.keys(content).length > 0 ? content : undefined,
    };
  }
  return result;
}

function generateExampleValue(schema: Record<string, unknown> | undefined): string | number | boolean | null {
  if (schema === undefined)
    return "";
  switch (schema.type) {
    case "string":
      return (schema as {example?: string}).example ?? (schema as {enum?: string[]}).enum?.[0] ?? "string";
    case "integer":
    case "number":
      return (schema as {example?: number}).example ?? 0;
    case "boolean":
      return (schema as {example?: boolean}).example ?? false;
    default:
      return "";
  }
}

function generateExampleFromSchema(schema: SchemaObject | undefined): unknown {
  if (schema === undefined)
    return null;

  if (schema.example !== undefined)
    return schema.example;

  switch (schema.type) {
    case "object": {
      const obj: Record<string, unknown> = {};
      if (schema.properties !== undefined) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(prop as Record<string, unknown>);
        }
      }
      return obj;
    }
    case "array":
      return schema.items !== undefined ? [generateExampleFromSchema(schema.items)] : [];
    case "string":
      return (schema as {enum?: unknown[]}).enum?.[0] ?? "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}
