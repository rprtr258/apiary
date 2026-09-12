import {describe, expect, test, afterEach} from "bun:test";
import {ComponentItem, LayoutManager, RowCol} from "./manager.ts";
import {Stack} from "./manager.ts";
import {cls} from "./styles.ts";
import type {ItemConfig} from "./types.ts";
import type {Option} from "@/option.ts";

const OPEN = "MyComponent";

function makeManager(): LayoutManager {
  const host = document.createElement("div");
  document.body.append(host);
  return new LayoutManager(host, {
    [OPEN]: container => {container.element.textContent = "panel";},
  }, {});
}

const stacksOf = (manager: LayoutManager) => [...manager.stacks()];
const titles = (stack: Stack): [string[], string] => [stack.children.map(c => c.title), titleOf(stack.activeComponentItem)!];
const titleOf = (item: Option<ComponentItem>) => item.map(v => v.title as string | undefined).getOr(undefined);
const tabTitles = (stack: Stack) =>
  [...stack.header.children]
  .filter(el => el.classList.contains("lm_tab"))
  .map(el => el.firstChild!.textContent!);

type Shape =
  | string
  | {stack: Shape[], active?: number}
  | {row: Shape[]}
  | {column: Shape[]}
;

// Compact serializable tree shape: {row: [...]}, {stack: [...], active: n} or a title string.
const shape = (cfg: ItemConfig): Shape => {
  switch (cfg.type) {
  case "component":
    return cfg.title;
  case "stack":
    return {stack: cfg.content.map(shape), active: cfg.activeItemIndex};
  case "row":
    return {row: cfg.content.map(shape)};
  default:
    return {column: cfg.content.map(shape)};
  }
};

describe("LayoutManager", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("extra group bug", () => {
    const manager = makeManager();

    // 1. open first request → single group with one tab
    {
      manager.addItem(OPEN, "req-1", {id: "req-1"});
      expect(stacksOf(manager)).toHaveLength(1);
      const first = stacksOf(manager)[0];
      expect(titles(first)).toEqual([["req-1"], "req-1"]);
    }

    // 2. open second request → opens as a tab in the same group
    {
      manager.addItem(OPEN, "req-2", {id: "req-2"});
      expect(stacksOf(manager)).toHaveLength(1);
      const first = stacksOf(manager)[0];
      expect(titles(first)).toEqual([["req-1", "req-2"], "req-2"]);
    }

    // 3. move the second request to the right → splits a new group to the right
    {
      const second: ComponentItem = stacksOf(manager)[0].children[1];
      expect(manager.moveToNextGroup(second)).toBe(true);
      expect(manager.rootItem instanceof RowCol).toBe(true);
      const [left, right] = stacksOf(manager);
      expect(stacksOf(manager)).toHaveLength(2);
      expect(titles(left)).toEqual([["req-1"], "req-1"]);
      expect(titles(right)).toEqual([["req-2"], "req-2"]);
      expect(titleOf(manager.activeTab())).toBe("req-2");
      // the new group sits to the right of the original one in the DOM
      expect(manager.rootItem?.element.contains(left.element)).toBe(true);
      expect(manager.rootItem?.element.contains(right.element)).toBe(true);
      expect([...manager.rootItem?.element.children ?? []].indexOf(left.element))
        .toBeLessThan([...manager.rootItem?.element.children ?? []].indexOf(right.element));
    }

    // 4. open third request → lands in the group holding the focused tab (req-2) and becomes active
    {
      manager.addItem(OPEN, "req-3", {id: "req-3"});
      expect(stacksOf(manager)).toHaveLength(2);
      const stacks = stacksOf(manager);
      expect(stacks.map(titles)).toEqual([
        [["req-1"], "req-1"],
        [["req-2", "req-3"], "req-3"],
      ]);
      expect(titleOf(manager.activeTab())).toBe("req-3");

      // tab DOM matches the tree; focused tab carries the current highlight
      expect(stacks.map(tabTitles)).toEqual([
        ["req-1"],
        ["req-2", "req-3"],
      ]);
      const [left, right] = stacks;
      expect(left.children[0].tab.element.classList.contains(cls.tabActive)).toBe(true);
      expect(left.children[0].tab.element.classList.contains(cls.tabCurrent)).toBe(false);
      expect(right.children[1].tab.element.classList.contains(cls.tabActive)).toBe(true);
      expect(right.children[1].tab.element.classList.contains(cls.tabCurrent)).toBe(true);

      const rootCfg = manager.layout.root;
      expect(shape(rootCfg!)).toEqual({
        row: [
          {stack: ["req-1"], active: 0},
          {stack: ["req-2", "req-3"], active: 1},
        ],
      });
    }
  });
});
