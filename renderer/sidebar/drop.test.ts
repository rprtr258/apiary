import {describe, test, expect} from "bun:test";
import {Kind, type Tree} from "@/types.ts";
import {dropToMove, type Drop} from "./drop.ts";
import type {TreeOption} from "../components/dataview.ts";

// drop.ts is type-only in its imports, so this file loads no DOM/store chain.

const option = (key: string): TreeOption => ({key, label: key});

function drop(node: string, dragNode: string, dropPosition: Drop["dropPosition"]): Drop {
  return {node: option(node), dragNode: option(dragNode), dropPosition};
}

function requests(entries: [string, string][]): Record<string, {path: string, kind: Kind, subKind: string}> {
  return Object.fromEntries(entries.map(([id, path]) => [id, {path, kind: Kind.MD, subKind: ""}]));
}

const req = (id: string) => ({kind: "req" as const, id});
const dir = (name: string, entries: Tree["entries"] = []): Tree["entries"][number] =>
  ({kind: "dir" as const, name, tree: {entries}});

describe("dropToMove", () => {
  const shape = {
    requests: requests([
      ["r1", "work/api"],
      ["r2", "work/db"],
      ["r3", "root-thing"],
    ]),
    tree: {entries: [
      dir("work", [req("r4"), req("r1"), req("r2")]),
      req("r3"),
    ]},
  };
  // r4 lives under work/ but has no record in `requests` above; add it
  shape.requests["r4"] = {path: "work/kernel", kind: Kind.MD, subKind: ""};

  test("drop after a request moves it into that request's dir at the next position", () => {
    const move = dropToMove(shape.requests, shape.tree, drop("r1", "r3", "after"));
    expect(move).toEqual({
      drag: {r: "r3"},
      toDir: "work",
      order: [{r: "r4"}, {r: "r1"}, {r: "r3"}, {r: "r2"}],
      renames: {r3: "work/root-thing"},
      expand: ["work"],
    });
  });

  test("drop before a request inserts at its position", () => {
    const move = dropToMove(shape.requests, shape.tree, drop("r1", "r3", "before"));
    expect(move?.order).toEqual([{r: "r4"}, {r: "r3"}, {r: "r1"}, {r: "r2"}]);
  });

  test("drop inside a dir appends at the end", () => {
    const move = dropToMove(shape.requests, shape.tree, drop("work", "r3", "inside"));
    expect(move?.toDir).toBe("work");
    expect(move?.order).toEqual([{r: "r4"}, {r: "r1"}, {r: "r2"}, {r: "r3"}]);
    expect(move?.renames).toEqual({r3: "work/root-thing"});
  });

  test("drop on the empty area (root node) moves to root", () => {
    const move = dropToMove(shape.requests, shape.tree, drop("", "r1", "inside"));
    expect(move?.toDir).toBe("");
    expect(move?.renames).toEqual({r1: "api"});
    expect(move?.order).toEqual([{d: "work"}, {r: "r3"}, {r: "r1"}]);
  });

  test("reordering within one dir renames nothing", () => {
    const move = dropToMove(shape.requests, shape.tree, drop("r2", "r4", "after"));
    expect(move?.renames).toEqual({});
    expect(move?.order).toEqual([{r: "r1"}, {r: "r2"}, {r: "r4"}]);
  });

  test("dropping an item back at its current position is a no-op", () => {
    // self-drop in every geometry
    expect(dropToMove(shape.requests, shape.tree, drop("r4", "r4", "after"))).toBeUndefined();
    expect(dropToMove(shape.requests, shape.tree, drop("r4", "r4", "before"))).toBeUndefined();
    // r4 is already right before r1
    expect(dropToMove(shape.requests, shape.tree, drop("r1", "r4", "before"))).toBeUndefined();
  });

  test("moving a dir repositions it in the target and prefix-renames its requests", () => {
    const move = dropToMove(
      requests([["r1", "keep/src/one"], ["r2", "keep/src/two"], ["r3", "solo"]]),
      {entries: [dir("keep", [dir("src", [req("r1"), req("r2")])]), req("r3")]},
      drop("r3", "keep/src", "after"),
    );
    expect(move).toEqual({
      drag: {d: "src"},
      toDir: "",
      order: [{d: "keep"}, {r: "r3"}, {d: "src"}],
      renames: {r1: "src/one", r2: "src/two"},
      expand: ["src"],
    });
  });

  test("moving a dir onto a same-named dir does not duplicate the entry", () => {
    const move = dropToMove(
      requests([["r1", "b/work/x"], ["r2", "a/work/y"]]),
      {entries: [dir("b", [dir("work", [req("r1")])]), dir("a", [dir("work", [req("r2")])])]},
      drop("b", "a/work", "inside"),
    );
    expect(move?.order.filter(e => "d" in e)).toEqual([{d: "work"}]);
    expect(move?.renames).toEqual({r2: "b/work/y"});
  });

  test("a dir cannot drop into itself or a descendant", () => {
    expect(dropToMove(shape.requests, shape.tree, drop("work", "work", "before"))).toBeUndefined();
    const nested = {entries: [dir("a", [dir("b", [req("r1")])])]};
    expect(dropToMove(requests([["r1", "a/b/x"]]), nested, drop("a/b", "a", "inside"))).toBeUndefined();
  });
});
