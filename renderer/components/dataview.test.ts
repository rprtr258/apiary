import {describe, test, expect} from "bun:test";
import {m} from "../lib/utils.ts";
import {NTree, NTag, NEmpty, NList, NListItem, Json, TagType, tagColors} from "./dataview.ts";
import type {TreeOption} from "./dataview.ts";

// NTree renders one flat row element per visible option; happy-dom has no
// layout, so each row is pinned to a 30px band to make the dragover
// thirds/halves geometry deterministic
type DropRecord = {node: TreeOption, dragNode: TreeOption, dropPosition: string};

function renderTree(data: TreeOption[], expandedKeys: string[] = []): {
  container: HTMLElement,
  rows: HTMLElement[],
  drops: DropRecord[],
} {
  const drops: DropRecord[] = [];
  const container = NTree({
    data,
    defaultExpandedKeys: expandedKeys,
    on: {
      "update:expanded-keys": () => undefined,
      drop: d => drops.push(d),
      click: () => undefined,
    },
    render: (option: TreeOption) => option.label,
  });
  const rows = Array.from(container.children) as HTMLElement[];
  for (const [i, row] of rows.entries()) {
    row.getBoundingClientRect = () =>
      ({top: i * 30, height: 30, bottom: (i + 1) * 30, left: 0, right: 100, width: 100, x: 0, y: i * 30, toJSON: () => undefined});
  }
  return {container, rows, drops};
}

// happy-dom's DragEvent is a broken MouseEvent subclass and ignores clientY
// in the init dict, so dispatch plain Events with the fields the handlers
// read (clientY, dataTransfer=null keeps dragstart's effectAllowed skip)
const fire = (row: HTMLElement, type: string, clientY = 0): void => {
  const e = new Event(type, {bubbles: true});
  Object.defineProperty(e, "clientY", {value: clientY});
  Object.defineProperty(e, "dataTransfer", {value: null});
  row.dispatchEvent(e);
};

describe("NTree drag marker", () => {
  test("boundary between sibling rows collapses to a single after-previous position", () => {
    const {container, rows, drops} = renderTree([
      {key: "a", label: "a"},
      {key: "b", label: "b"},
      {key: "c", label: "c"},
    ]);
    fire(rows[2], "dragstart"); // dragging c
    // top half of b: same slot as the bottom half of a, so it must report
    // the previous row instead of duplicating the boundary
    fire(rows[1], "dragover", 35);
    fire(container, "drop");
    expect(drops).toEqual([
      {node: {key: "a", label: "a"}, dragNode: {key: "c", label: "c"}, dropPosition: "after"},
    ]);
  });

  // Pin: this boundary is NOT a duplicate — the bottom half of the dir's last
  // child drops inside the dir, the top half of the next outer row drops at
  // the outer level — so it must keep both positions
  test("boundary between a dir's last child and the next outer row keeps before", () => {
    const {container, rows, drops} = renderTree([
      {key: "work", label: "work", children: [{key: "work/x", label: "x"}]},
      {key: "other", label: "other"},
    ], ["work"]);
    fire(rows[2], "dragstart"); // dragging other
    fire(rows[2], "dragover", 65); // top half of other (prev row x is in another dir)
    fire(container, "drop");
    expect(drops).toEqual([
      {node: {key: "other", label: "other"}, dragNode: {key: "other", label: "other"}, dropPosition: "before"},
    ]);
  });

  const markerLines = (rows: HTMLElement[]): {row: HTMLElement, line: HTMLElement}[] =>
    rows.flatMap(row =>
      Array.from(row.children)
        .filter(c => (c as HTMLElement).style.position === "absolute")
        .map(c => ({row, line: c as HTMLElement})));

  test("drop line is drawn at the previous row's bottom edge for a collapsed boundary", () => {
    const {rows} = renderTree([
      {key: "a", label: "a"},
      {key: "b", label: "b"},
      {key: "c", label: "c"},
    ]);
    fire(rows[2], "dragstart");
    fire(rows[1], "dragover", 35); // top half of b → collapsed after-a
    expect(markerLines(rows).map(({row}) => row)).toEqual([rows[0]]);
    const {line} = markerLines(rows)[0];
    expect(line.style.bottom).toBe("0px");
    expect(line.style.top).toBe("");
  });

  const lineInfo = (rows: HTMLElement[]) =>
    markerLines(rows).map(({row, line}) => ({
      row: rows.indexOf(row),
      left: line.style.left,
      edge: line.style.bottom !== "" ? "bottom" : "top",
    }));

  test("drop line indents to the level the item lands at", () => {
    const {rows} = renderTree([
      {key: "work", label: "work", children: [{key: "work/x", label: "x"}]},
      {key: "other", label: "other"},
    ], ["work"]);
    fire(rows[2], "dragstart");
    // after the dir's last child lands inside the dir (level 1) → indented
    fire(rows[1], "dragover", 55);
    expect(lineInfo(rows)).toEqual([
      {row: 1, left: "1.5em", edge: "bottom"},
    ]);
    // before the next outer row lands at the outer level (0) → full width
    fire(rows[2], "dragover", 65);
    expect(lineInfo(rows)).toEqual([
      {row: 2, left: "0em", edge: "top"},
    ]);
  });

  test("dropping inside a dir highlights the row without a line", () => {
    const {container, rows, drops} = renderTree([
      {key: "work", label: "work", children: [{key: "work/x", label: "x"}]},
    ], ["work"]);
    fire(rows[1], "dragstart");
    fire(rows[0], "dragover", 15); // middle third of work
    expect(markerLines(rows)).toEqual([]);
    fire(container, "drop");
    expect(drops[0].dropPosition).toBe("inside");
  });

  test("bottom edge of an expanded dir drops as the dir's first child", () => {
    const {container, rows, drops} = renderTree([
      {key: "data", label: "data", children: [{key: "data/abc", label: "abc"}]},
      {key: "kek", label: "kek"},
    ], ["data"]);
    fire(rows[2], "dragstart"); // dragging kek
    fire(rows[0], "dragover", 26); // bottom third of data: the line draws
    // between data and abc, so it must mean that boundary (kek under data,
    // before abc), not root-level after data
    expect(lineInfo(rows)).toEqual([{row: 1, left: "1.5em", edge: "top"}]);
    fire(container, "drop");
    expect(drops.map(({node, dragNode, dropPosition}) => ({node: node.key, dragNode: dragNode.key, dropPosition}))).toEqual([
      {node: "data/abc", dragNode: "kek", dropPosition: "before"},
    ]);
  });

  // Pins, green as written (payloads compared by scalar fields: node/dragNode
  // are the live option objects, which carry children arrays)
  test("bottom edge of a collapsed dir stays at the parent level", () => {
    const {container, rows, drops} = renderTree([
      {key: "data", label: "data", children: [{key: "data/abc", label: "abc"}]},
      {key: "kek", label: "kek"},
    ]);
    fire(rows[1], "dragstart");
    fire(rows[0], "dragover", 26);
    fire(container, "drop");
    expect(drops.map(({node, dropPosition}) => ({node: node.key, dropPosition}))).toEqual([
      {node: "data", dropPosition: "after"},
    ]);
  });

  test("bottom edge of a request with virtual children stays at the parent level", () => {
    const {container, rows, drops} = renderTree([
      {key: "src", label: "src", children: [{key: "virtual:tbl1", label: "tbl1", draggable: false}]},
      {key: "other", label: "other"},
    ], ["src"]);
    fire(rows[2], "dragstart");
    fire(rows[0], "dragover", 26);
    fire(container, "drop");
    expect(drops.map(({node, dropPosition}) => ({node: node.key, dropPosition}))).toEqual([
      {node: "src", dropPosition: "after"},
    ]);
  });
});

describe("Json component", () => {
  test.each([
    ["renders JSON data as formatted string", {name: "test", value: 42, nested: {foo: "bar"}}, `{
  "name": "test",
  "value": 42,
  "nested": {
    "foo": "bar"
  }
}`],
    ["handles string value", "test string", `"test string"`],
    ["handles number value", 123, `123`],
    ["handles boolean value", true, `true`],
    ["handles null value", null, `null`],
  ])("%s", (_name, data, output) => {
    const component = Json(data);
    expect(component.tagName).toBe("PRE");
    expect(component.textContent).toBe(output);
  });
});

describe("NTag component", () => {
  test.each([
    ["success", "Success", "var(--green)"],
    ["error", "Error", "var(--err)"],
    ["warning", "Warning", "var(--warn)"],
    ["info", "Info", "var(--accent)"],
  ] as [TagType, string, string][])("%s", (type, label, color) => {
    const component = NTag({label, color: tagColors[type]});
    expect(component.tagName).toBe("SPAN");
    expect(component.textContent).toBe(label);
    expect(component.style.color).toBe(color);
  });

  test("applies custom styles", () => {
    const tag = NTag({
      label: "Styled",
      color: tagColors["success"],
      style: {fontSize: "14px", margin: "5px"},
    });

    expect(tag.style.fontSize).toBe("14px");
    expect(tag.style.margin).toBe("5px");
    expect(tag.style.color).toBe("var(--green)");
  });

  test("handles round prop", () => {
    const tag = NTag({label: "Rounded", color: tagColors["success"]});
    expect(tag.tagName).toBe("SPAN");
    expect(tag.textContent).toBe("Rounded");
  });

  test("includes title attribute when provided", () => {
    const tag = NTag({
      label: "Success",
      color: tagColors["success"],
      tooltip: "Success tooltip",
    });
    expect(tag.tagName).toBe("SPAN");
    expect(tag.textContent).toBe("Success");
    expect(tag.title).toBe("Success tooltip");
  });
});

describe("NEmpty component", () => {
  test("renders empty state with description", () => {
    const empty = NEmpty({
      description: "No data available",
    });

    expect(empty.tagName).toBe("DIV");
    expect(empty.className).toBe("h100");
    expect(empty.style.display).toBe("flex");
    expect(empty.style.alignItems).toBe("center");
    expect(empty.style.justifyContent).toBe("center");
    expect(empty.textContent).toBe("No data available");
  });

  test("renders heading with status and title", () => {
    const empty = NEmpty({
      status: "info",
      title: "Test Title",
      description: "Test Description",
    });

    expect(empty.style.flexDirection).toBe("column");

    const h1 = empty.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain("Test Title");

    const textNodes = Array.from(empty.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    const descriptionNode = textNodes.find(n => n.textContent?.includes("Test Description") ?? false);
    expect(descriptionNode).not.toBeUndefined();
  });

  test("renders string status as text in heading", () => {
    const empty = NEmpty({
      status: "404",
      title: "Not Found",
      description: "Page not found",
    });

    const h1 = empty.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain("404");
    expect(h1!.textContent).toContain("Not Found");
  });
});

describe("NList and NListItem components", () => {
  test("creates list with items", () => {
    const list = NList(
      NListItem({class: "item1"}, ["Item 1"]),
      NListItem({class: "item2"}, ["Item 2"]),
      NListItem({class: "item3"}, ["Item 3"]),
    );
    expect(list.tagName).toBe("UL");

    const items = Array.from(list.children).map(({tagName, className, textContent}) => {
      expect(tagName).toBe("LI");
      return {className, textContent};
    });
    expect(items).toEqual([
      {className: "item1", textContent: "Item 1"},
      {className: "item2", textContent: "Item 2"},
      {className: "item3", textContent: "Item 3"},
    ]);
  });

  test("creates empty list", () => {
    const list = NList();
    expect(list.tagName).toBe("UL");
    expect(list.children.length).toBe(0);
  });

  test("list item with multiple children", () => {
    const listItem = NListItem({class: "multi"}, [
      m("span", {}, "Prefix"),
      " Text ",
      m("span", {}, "Suffix"),
    ]);

    expect(listItem.tagName).toBe("LI");
    expect(listItem.className).toBe("multi");
    expect(listItem.children.length).toBe(2);
    expect(listItem.textContent).toBe("Prefix Text Suffix");
  });
});
