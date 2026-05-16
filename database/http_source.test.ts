import {describe, test, expect} from "bun:test";
import {parseSpec, generateExampleRequest} from "./http_source.ts";

const petstoreV2 = JSON.stringify({
  swagger: "2.0",
  info: {title: "Pet Store", version: "1.0"},
  host: "petstore.swagger.io",
  basePath: "/v2",
  paths: {
    "/pet": {
      post: {
        summary: "Add a new pet",
        parameters: [
          {name: "body", in: "body", required: true, schema: {$ref: "#/definitions/Pet"}},
        ],
        responses: {"200": {description: "successful operation"}},
      },
    },
    "/pet/{petId}": {
      get: {
        summary: "Find pet by ID",
        parameters: [
          {name: "petId", in: "path", required: true, type: "integer"},
        ],
        responses: {"200": {description: "successful operation"}},
      },
    },
  },
  definitions: {
    Pet: {
      type: "object",
      properties: {
        id: {type: "integer"},
        name: {type: "string"},
      },
    },
  },
});

const petstoreV3 = JSON.stringify({
  openapi: "3.0.0",
  info: {title: "Pet Store", version: "1.0"},
  paths: {
    "/pets": {
      get: {
        summary: "List all pets",
        parameters: [
          {name: "limit", in: "query", required: false, schema: {type: "integer"}},
        ],
        responses: {
          "200": {
            description: "A list of pets",
            content: {"application/json": {schema: {type: "array", items: {$ref: "#/components/schemas/Pet"}}}},
          },
        },
      },
      post: {
        summary: "Create a pet",
        requestBody: {
          required: true,
          content: {"application/json": {schema: {$ref: "#/components/schemas/Pet"}}},
        },
        responses: {"201": {description: "Created"}},
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        properties: {
          id: {type: "integer"},
          name: {type: "string"},
          tag: {type: "string"},
        },
      },
    },
  },
});

describe("parseSpec", () => {
  test("parses OpenAPI v2 endpoints", () => {
    const endpoints = parseSpec(petstoreV2);
    expect(endpoints.length).toBe(2);
    // POST /pet and GET /pet/{petId}
    const postPet = endpoints.find(e => e.method === "POST" && e.path === "/pet");
    expect(postPet).toBeTruthy();
    expect(postPet?.summary).toBe("Add a new pet");
    const getPet = endpoints.find(e => e.method === "GET" && e.path === "/pet/{petId}");
    expect(getPet).toBeTruthy();
  });

  test("parses OpenAPI v3 endpoints", () => {
    const endpoints = parseSpec(petstoreV3);
    expect(endpoints.length).toBe(2);
    expect(endpoints.some(e => e.method === "GET" && e.path === "/pets")).toBe(true);
    expect(endpoints.some(e => e.method === "POST" && e.path === "/pets")).toBe(true);
  });

  test("extracts parameters from v3 endpoints", () => {
    const endpoints = parseSpec(petstoreV3);
    const getEndpoint = endpoints.find(e => e.method === "GET");
    expect(getEndpoint?.parameters).toHaveLength(1);
    expect(getEndpoint?.parameters[0].name).toBe("limit");
    expect(getEndpoint?.parameters[0].in).toBe("query");
  });

  test("extracts request body from v3 endpoints", () => {
    const endpoints = parseSpec(petstoreV3);
    const postEndpoint = endpoints.find(e => e.method === "POST");
    expect(postEndpoint?.requestBody).toBeTruthy();
    expect(postEndpoint?.requestBody?.required).toBe(true);
  });

  test("returns empty for spec without paths", () => {
    const endpoints = parseSpec(JSON.stringify({openapi: "3.0.0", info: {title: "empty"}, paths: {}}));
    expect(endpoints).toEqual([]);
  });
});

describe("generateExampleRequest", () => {
  test("generates example for v3 POST endpoint", () => {
    const endpoints = parseSpec(petstoreV3);
    const postIdx = endpoints.findIndex(e => e.method === "POST");
    const example = generateExampleRequest(petstoreV3, postIdx);
    expect(example.method).toBe("POST");
    expect(example.body).toBeTruthy();
    expect(example.headers.some(h => h.key === "Content-Type")).toBe(true);
  });

  test("generates example for v3 GET endpoint with query params", () => {
    const endpoints = parseSpec(petstoreV3);
    const getIdx = endpoints.findIndex(e => e.method === "GET");
    const example = generateExampleRequest(petstoreV3, getIdx);
    expect(example.method).toBe("GET");
  });

  test("throws for invalid endpoint index", () => {
    expect(() => generateExampleRequest(petstoreV3, 999)).toThrow();
  });
});
