import {JSONSchema, JSONValue} from "./types.ts";

export function generateExampleValue(schema: JSONSchema | undefined): JSONValue {
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

export function generateExampleFromSchema(schema: JSONSchema | undefined, seen: Set<JSONSchema> = new Set()): JSONValue {
  if (schema === undefined)
    return null;

  if (schema.example !== undefined)
    return schema.example;

  // self-referential schema (e.g. Dir with items of Dir): cut the cycle
  if (seen.has(schema))
    return {};

  seen.add(schema);
  const result = exampleFor(schema, seen);
  seen.delete(schema);
  return result;
}

function exampleFor(schema: JSONSchema, seen: Set<JSONSchema>): JSONValue {
  switch (schema.type) {
    case "object":
      if (schema.oneOf !== undefined && schema.oneOf.length > 0)
        return generateExampleFromSchema(schema.oneOf[Math.floor(Math.random() * schema.oneOf.length)], seen);
      return Object.fromEntries(Object
        .entries(schema.properties)
        .map(([key, prop]) => [key, generateExampleFromSchema(prop, seen)]));
    case "array":
      return [generateExampleFromSchema(schema.items, seen)];
    case "string":
      return schema.enum?.[0] ?? "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}
