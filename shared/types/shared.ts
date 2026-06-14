export type KV = {
  key: string,
  value: string,
};

// JSONSchema represents the structure of a JSON schema
export type JSONSchema = { // TODO: reuse from lib
  type: "object",
  properties: Record<string, JSONSchema>,
  oneOf?: JSONSchema[],
} | {
  type: "array",
  items: JSONSchema,
} | {
  type: "number" | "integer" | "string",
};
