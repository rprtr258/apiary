import {describe, test, expect, mock} from "bun:test";
import {Kind, type TableInfo, type MCPTool, type MCPPrompt, type MCPListItems} from "@/types.ts";
import {ok, type Result} from "@/result.ts";
import type {Item} from "./source.ts";

// Tests below drive the store-backed module chain (source.ts -> store.ts ->
// api.ts); bun runs without the Electron bridge and api.ts captures window.api
// at module load, so the api module is replaced with a recording stub before
// anything under test is imported. Results must be real ok()/err() values:
// the MCP fetchers call .map on them.
const apiCalls = {tables: [] as string[], mcp: [] as string[]};
const tableInfo: TableInfo = {name: "users", rowCount: 3, sizeBytes: 128};
const mcpTool = {kind: "tool", name: "my-tool", description: "", inputSchema: {}} as unknown as MCPTool;
const mcpPrompt = {kind: "prompt", name: "my-prompt", description: "", arguments: []} as unknown as MCPPrompt;
mock.module("../api.ts", () => ({
  api: {
    async requestListTablesSQLSource(id: string): Promise<Result<TableInfo[]>> {
      apiCalls.tables.push(id);
      return ok([tableInfo]);
    },
    async mcpListItems(id: string): Promise<Result<MCPListItems>> {
      apiCalls.mcp.push(id);
      return ok({tools: [mcpTool], prompts: [mcpPrompt]});
    },
  },
}));

const {changed} = await import("./cache.ts");
const src = await import("./source.ts");
const {store} = await import("../store.ts");
const {composeVirtualKey, parseVirtualKey, resolveIn, sourceTree, sourceChildren} = src;

function item(overrides: Partial<Item> & {key: string, label?: string}): Item {
  return {label: overrides.key, ...overrides};
}

describe("virtual key codec", () => {
  test("round-trips segments containing \":\" and \"/\" (HTTP endpoint keys)", () => {
    const segments = ["GET ", "user", ":id"];
    const key = composeVirtualKey("HTTPSource", "src1", segments);
    const parsed = parseVirtualKey(key);
    expect(parsed.unwrap()).toEqual({kind: "HTTPSource", sourceID: "src1", segments});
  });

  test("round-trips segments with multiple colons", () => {
    const segments = [":a:b:c"];
    const parsed = parseVirtualKey(composeVirtualKey("MCP", "id1", segments));
    expect(parsed.unwrap().segments).toEqual(segments);
  });

  test("round-trips segments with backslashes", () => {
    const segments = ["back\\slash", "x:y"];
    const parsed = parseVirtualKey(composeVirtualKey("MCP", "id1", segments));
    expect(parsed.unwrap()).toEqual({kind: "MCP", sourceID: "id1", segments});
  });

  test("keeps \"/\" intact inside a single segment (MCP-style keys)", () => {
    const segments = ["Tools/fs/read_file"];
    const parsed = parseVirtualKey(composeVirtualKey("MCP", "id1", segments));
    expect(parsed.unwrap().segments).toEqual(segments);
  });

  test("parses legacy unescaped keys", () => {
    const parsed = parseVirtualKey("virtual:MCP:abc:Tools/tool-a");
    expect(parsed.unwrap()).toEqual({kind: "MCP", sourceID: "abc", segments: ["Tools/tool-a"]});
  });

  test("rejects non-virtual and truncated keys", () => {
    expect(parseVirtualKey("req-id-123").isNone()).toBe(true);
    expect(parseVirtualKey("virtual:MCP:abc").isNone()).toBe(true);
    expect(parseVirtualKey("virtual:").isNone()).toBe(true);
  });
});

describe("sourceTree materialization", () => {
  test("collapsed request row yields no children and never calls thunks", () => {
    let calls = 0;
    const root: Item = {
      key: "", label: "",
      children: () => {
        calls += 1;
        return [item({key: "a"})];
      },
    };
    const options = sourceTree("id1", "SQLSource", root, new Set(["other"]));
    expect(options).toEqual([]);
    expect(calls).toBe(0);
  });

  test("expanded request row materializes leaves with baked tag and composed keys", () => {
    const root: Item = {
      key: "", label: "",
      children: () => [item({key: "users", label: "users (3 rows)", badge: {label: "TBL", color: "white"}})],
    };
    const options = sourceTree("id1", "SQLSource", root, new Set(["id1"]));
    expect(options).toEqual([{
      key: "virtual:SQLSource:id1:users",
      label: "users (3 rows)",
      tag: {label: "TBL", color: "white"},
    }]);
  });

  test("nests \"/\"-separated item keys into folder chains", () => {
    const root: Item = {
      key: "", label: "",
      children: () => [
        item({key: "GET /health", label: "/health/"}),
        item({key: "GET /users/:id", label: "/users/:id/"}),
      ],
    };
    const options = sourceTree("id1", "HTTPSource", root, new Set([
      "id1",
      "virtual:HTTPSource:id1:GET ",
      "virtual:HTTPSource:id1:GET :users",
    ]));
    expect(options).toEqual([{
      label: "GET ",
      key: "virtual:HTTPSource:id1:GET ",
      children: [
        {
          key: "virtual:HTTPSource:id1:GET :health",
          label: "/health/",
        },
        {
          key: "virtual:HTTPSource:id1:GET :users",
          label: "users",
          children: [{
            key: "virtual:HTTPSource:id1:GET :users:\\:id",
            label: "/users/:id/",
          }],
        },
      ],
    }]);
  });

  test("empty listing shows Loading... while in flight", () => {
    const loadingRoot: Item = {key: "", label: "", children: () => [], loading: () => true};
    const loadingOptions = sourceTree("id1", "MCP", loadingRoot, new Set(["id1"]));
    expect(loadingOptions).toEqual([{
      key: "virtual:loading:id1:MCP",
      label: "Loading...",
      disabled: true,
    }]);
  });

  test("empty listing shows (None) when not in flight", () => {
    const emptyRoot: Item = {key: "", label: "", children: () => []};
    const emptyOptions = sourceTree("id1", "MCP", emptyRoot, new Set(["id1"]));
    expect(emptyOptions).toEqual([{
      key: "virtual:empty:id1:MCP",
      label: "(None)",
      disabled: true,
    }]);
  });

  test("placeholder keys under nested folders include the folder path", () => {
    const root: Item = {
      key: "", label: "",
      children: () => [item({key: "Tools", label: "Tools", children: () => [], loading: () => true})],
    };
    const options = sourceTree("id1", "MCP", root, new Set(["id1", "virtual:MCP:id1:Tools"]));
    expect(options[0].children).toEqual([{
      key: "virtual:loading:id1:MCP:Tools",
      label: "Loading...",
      disabled: true,
    }]);
  });

  test("collapsed folders are expandable without calling their thunks", () => {
    let calls = 0;
    const root: Item = {
      key: "", label: "",
      children: () => [item({
        key: "Tools",
        label: "Tools",
        children: () => {
          calls += 1;
          return [item({key: "tool-a"})];
        },
      })],
    };
    const options = sourceTree("id1", "MCP", root, new Set(["id1"]));
    expect(options[0].children).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("resolveIn", () => {
  test("fires onOpen for a flat leaf", () => {
    let opened = 0;
    resolveIn([item({key: "a", onOpen: () => {
      opened += 1;
    }})], ["a"]);
    expect(opened).toBe(1);
  });

  test("walks structural folders (Tools/Prompts)", () => {
    let opened = 0;
    const items: Item[] = [item({
      key: "Tools",
      label: "Tools",
      children: () => [item({key: "tool-a", onOpen: () => {
        opened += 1;
      }})],
    })];
    resolveIn(items, ["Tools", "tool-a"]);
    expect(opened).toBe(1);
  });

  test("walks \"/\"-nested item keys (HTTP endpoint with :param)", () => {
    let opened = 0;
    const items: Item[] = [item({key: "GET /users/:id", onOpen: () => {
      opened += 1;
    }})];
    resolveIn(items, ["GET ", "users", ":id"]);
    expect(opened).toBe(1);
  });

  test("misses resolve silently without firing onOpen", () => {
    let opened = 0;
    const items: Item[] = [
      item({key: "GET /users/:id", onOpen: () => {
        opened += 1;
      }}),
      item({key: "Tools", children: () => [item({key: "tool-a"})]}),
    ];
    resolveIn(items, ["GET ", "users", "nope"]);
    resolveIn(items, ["Tools", "tool-a", "deeper"]);
    resolveIn(items, ["missing"]);
    resolveIn(items, []);
    expect(opened).toBe(0);
  });
});

// Regression tests: source listings never loaded when their request row was
// expanded on app start. The sidebar (sidebar/tree.ts) materializes expanded
// rows inside its changed-signal subscriber generator; a fetch fired from
// there used to notify `changed` synchronously, which calls .next() on the
// RUNNING subscriber generator - a hard JS error - aborting the fetch before
// the API call and leaving the listing stuck in loading state forever.
describe("source listing load (row expanded on start)", () => {
  const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

  const seedRequest = (id: string, kind: Kind): void => {
    store.requests[id] = {path: id, kind, subKind: ""};
  };

  // Mirror of sidebar/tree.ts's rebuild subscription: registered first, and
  // its registration render materializes the expanded row INSIDE the
  // subscriber generator frame.
  const withTreeMirror = (id: string, expanded: ReadonlySet<string>): (() => void) =>
    changed.sub(function*() {
      while (true) {
        yield;
        sourceChildren(id, expanded);
      }
    }());

  test("sql source subitems load when the row is expanded on start", async () => {
    const id = "test-sql-source";
    seedRequest(id, Kind.SQLSource);
    const expanded = new Set([id]);
    const unmount = withTreeMirror(id, expanded);
    try {
      await tick();
      expect(apiCalls.tables).toEqual([id]);
      const options = sourceChildren(id, expanded) ?? [];
      expect(options).toHaveLength(1);
      expect(options[0]?.label.startsWith("users")).toBe(true);
      expect(options[0]?.children).toBeUndefined(); // real leaf, not a placeholder
    } finally {
      unmount();
      delete store.requests[id];
    }
  });

  test("expanded mcp row eagerly loads tools and prompts with one IPC call", async () => {
    const id = "test-mcp-source";
    seedRequest(id, Kind.MCP);
    const expanded = new Set([
      id,
      composeVirtualKey(Kind.MCP, id, ["Tools"]),
      composeVirtualKey(Kind.MCP, id, ["Prompts"]),
    ]);
    const unmount = withTreeMirror(id, expanded);
    try {
      await tick();
      expect(apiCalls.mcp).toEqual([id]); // tools and prompts share one deduped call
      const options = sourceChildren(id, expanded) ?? [];
      const tools = options.find(option => option.label === "Tools")?.children ?? [];
      const prompts = options.find(option => option.label === "Prompts")?.children ?? [];
      expect(tools.map(option => option.label)).toEqual(["my-tool"]);
      expect(prompts.map(option => option.label)).toEqual(["my-prompt"]);
    } finally {
      unmount();
      delete store.requests[id];
    }
  });
});
