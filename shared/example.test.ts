import {describe, test, expect} from "bun:test";
import {JSONSchema, JSONValue} from "./types.ts";
import {generateExampleFromSchema} from "./example.ts";

describe("generateExampleFromSchema", () => {
  const str: JSONSchema = {type: "string"};
  for (const [schema, expected] of [
    [undefined, null],
    [{type: "string", enum: ["a", "b"]}, "a"],
    [{type: "integer"}, 0],
    [{type: "boolean"}, false],
    [{type: "string", example: "custom"}, "custom"],
    [{
      type: "object",
      properties: {
        name: str,
        tags: {type: "array", items: str},
      },
    }, {name: "string", tags: ["string"]}],
    [{
      type: "object",
      properties: {a: str, b: str},
    }, {a: "string", b: "string"}],
  ] as [JSONSchema | undefined, JSONValue][]) {
    test(JSON.stringify(schema), () => {
      expect(generateExampleFromSchema(schema)).toEqual(expected);
    });
  }

  test("Dir with items of Dir|File (oneOf) terminates with a well-formed example", () => {
    const file: JSONSchema = {type: "object", properties: {name: str, size: {type: "integer"}}};
    const dir: JSONSchema = {type: "object", properties: {name: str}};
    dir.properties.items = {type: "array", items: {type: "object", properties: {}, oneOf: [dir, file]}};

    // random variant pick: Dir (cycle-cut by seen) or File — both finite
    const outcomes: JSONValue[] = [
      {name: "string", items: [{}]},
      {name: "string", items: [{name: "string", size: 0}]},
    ];
    for (let i = 0; i < 100; i++) {
      expect(outcomes).toContainEqual(generateExampleFromSchema(dir));
    }
  });

  test("self-referential Dir (items of the same Dir) terminates with a shallow example", () => {
    const dir: {type: "object", properties: Record<string, JSONSchema>} = {type: "object", properties: {name: str}};
    dir.properties.items = {type: "array", items: dir};

    expect(generateExampleFromSchema(dir)).toEqual({name: "string", items: [{}]});
  });
});
