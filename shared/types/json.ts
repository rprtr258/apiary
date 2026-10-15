import {JSONValue} from "@/types.ts";

export type KV = {
  key: string,
  value: string,
};

// JSONSchema represents the structure of a JSON schema
export type JSONSchema = {
  example?: JSONValue,
} & ({ // TODO: reuse from lib
  "$schema"?: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: Record<string, JSONSchema>,
  oneOf?: JSONSchema[],
  required?: [string],
} | {
  type: "array",
  items: JSONSchema,
} | {
  type: "number" | "integer" | "boolean",
} | {
  type: "string",
  enum?: string[],
});
