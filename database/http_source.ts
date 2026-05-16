import type {HTTPSourceRequest, HTTPRequest, EndpointInfo, ParameterInfo, MediaTypeInfo, RequestBodyInfo, ResponseInfo} from "../types/models.ts";
import type {OpenAPIV2, OpenAPIV3, OpenAPIV3_1} from "openapi-types";

type OpenAPIObject     = OpenAPIV2.Document           |   OpenAPIV3.Document          | OpenAPIV3_1.Document;
type PathItemObject    = OpenAPIV2.PathItemObject     |   OpenAPIV3.PathItemObject    | OpenAPIV3_1.PathItemObject;
type OperationObject   = OpenAPIV2.OperationObject    |   OpenAPIV3.OperationObject   | OpenAPIV3_1.OperationObject;
type ParameterObject   = OpenAPIV2.ParameterObject    |   OpenAPIV3.ParameterObject/* | OpenAPIV3_1.ParameterObject*/;
type SchemaObject      = OpenAPIV2.SchemaObject       |   OpenAPIV3.SchemaObject      | OpenAPIV3_1.SchemaObject;
type RequestBodyObject = /*OpenAPIV2.RequestBodyObject|*/ OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;
type MediaTypeObject   = /*OpenAPIV2.MediaTypeObject  |*/ OpenAPIV3.MediaTypeObject   | OpenAPIV3_1.MediaTypeObject;
type ResponsesObject   = /*OpenAPIV2.ResponsesObject  |*/ OpenAPIV3.ResponsesObject   | OpenAPIV3_1.ResponsesObject;
type ReferenceObject   =   OpenAPIV2.ReferenceObject  |   OpenAPIV3.ReferenceObject   | OpenAPIV3_1.ReferenceObject;

export async function fetchSpec(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(`failed to fetch spec: ${resp.status}`);
  return await resp.text();
}

export function parseSpec(specData: string): EndpointInfo[] {
  const spec = JSON.parse(specData) as OpenAPIObject;
  const endpoints: EndpointInfo[] = [];

  if (!spec.paths)
    return endpoints;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const item = pathItem as PathItemObject | undefined;
    if (!item) continue;

    const methods = ["get", "post", "put", "delete", "patch", "head", "options"] as const;
    for (const method of methods) {
      const operation = item[method] as OperationObject | undefined;
      if (!operation)
        continue;

      endpoints.push({
        path,
        method: method.toUpperCase(),
        summary: operation.summary ?? operation.description ?? "",
        parameters: extractParameters(operation),
        requestBody: operation.requestBody ? extractRequestBody(operation.requestBody) : undefined,
        responses: extractResponses(operation.responses),
      });
    }
  }

  return endpoints;
}

export function generateExampleRequest(
  specData: string,
  endpointIndex: number,
): HTTPRequest {
  const endpoints = parseSpec(specData);
  const endpoint = endpoints[endpointIndex];
  if (!endpoint)
    throw new Error(`endpoint ${endpointIndex} not found`);

  const headers: Array<{key: string, value: string}> = [];
  for (const param of endpoint.parameters) {
    if (param.in === "header") {
      headers.push({key: param.name, value: String(generateExampleValue(param.schema) ?? "")});
    }
  }
  headers.push({key: "Content-Type", value: "application/json"});

  let body = "";
  if (endpoint.requestBody) {
    const mediaType = endpoint.requestBody.content?.["application/json"];
    if (mediaType?.schema) {
      body = JSON.stringify(generateExampleFromSchema(mediaType.schema), null, 2);
    }
  }

  // Build URL with path params replaced
  let url = endpoint.path;
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
    schema: p.schema ?? {},
    example: undefined,
  })) ?? [];
}

function extractRequestBody(requestBody: RequestBodyObject | ReferenceObject): RequestBodyInfo {
  const content: Record<string, MediaTypeInfo> = {};
  if (requestBody.content) {
    for (const [mediaType, mediaTypeObj] of Object.entries(requestBody.content)) {
      content[mediaType] = {
        schema: (mediaTypeObj as MediaTypeObject).schema as Record<string, unknown> ?? {},
        example: undefined,
      };
    }
  }
  return {
    description: (requestBody.description as string) ?? "",
    required: (requestBody.required as boolean) ?? false,
    content,
  };
}

function extractResponses(responses: ResponsesObject | undefined): Record<string, ResponseInfo> {
  if (!responses) return {};
  const result: Record<string, ResponseInfo> = {};
  for (const [code, response] of Object.entries(responses)) {
    const respObj = response as {description?: string, content?: Record<string, MediaTypeObject>};
    const content: Record<string, MediaTypeInfo> = {};
    if (respObj.content) {
      for (const [mediaType, mediaTypeObj] of Object.entries(respObj.content)) {
        content[mediaType] = {
          schema: mediaTypeObj.schema ?? {},
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
  if (!schema) return "";
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
  if (!schema) return null;

  if (schema.example !== undefined) return schema.example;

  switch (schema.type) {
    case "object": {
      const obj: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(prop as Record<string, unknown>);
        }
      }
      return obj;
    }
    case "array":
      return schema.items ? [generateExampleFromSchema(schema.items)] : [];
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
