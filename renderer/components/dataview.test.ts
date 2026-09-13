import {describe, test, expect} from "bun:test";
import {m} from "../lib/utils.ts";
import {NTag, NResult, NEmpty, NList, NListItem, Json, TagType} from "./dataview.ts";

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
    ["success", "Success", "lime"],
    ["error", "Error", "red"],
    ["warning", "Warning", "yellow"],
    ["info", "Info", "blue"],
  ] as [TagType, string, string][])("%s", (type, label, color) => {
    const component = NTag({type}, label);
    expect(component.tagName).toBe("SPAN");
    expect(component.textContent).toBe(label);
    expect(component.style.color).toBe(color);
  });

  test("applies custom styles", () => {
    const tag = NTag({
      type: "success",
      style: {fontSize: "14px", margin: "5px"},
    }, "Styled");

    expect(tag.style.fontSize).toBe("14px");
    expect(tag.style.margin).toBe("5px");
    expect(tag.style.color).toBe("lime");
  });

  test("handles round prop", () => {
    const tag = NTag({type: "success"}, "Rounded");
    expect(tag.tagName).toBe("SPAN");
    expect(tag.textContent).toBe("Rounded");
  });

  test("includes title attribute when provided", () => {
    const tag = NTag({type: "success", tooltip: "Success tooltip"}, "Success");
    expect(tag.tagName).toBe("SPAN");
    expect(tag.textContent).toBe("Success");
    expect(tag.title).toBe("Success tooltip");
  });
});

describe("NResult component", () => {
  test("renders result with info status", () => {
    const result = NResult({
      status: "info",
      title: "Test Title",
      description: "Test Description",
    });

    expect(result.tagName).toBe("DIV");
    expect(result.style.display).toBe("flex");
    expect(result.style.justifyContent).toBe("center");
    expect(result.style.alignItems).toBe("center");
    expect(result.style.flexDirection).toBe("column");

    const h1 = result.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain("Test Title");

    // Find text node for description
    const textNodes = Array.from(result.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    const descriptionNode = textNodes.find(n => n.textContent?.includes("Test Description") ?? false);
    expect(descriptionNode).not.toBeUndefined();
  });

  test("renders result with string status", () => {
    const result = NResult({
      status: "404",
      title: "Not Found",
      description: "Page not found",
    });

    const h1 = result.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain("404");
    expect(h1!.textContent).toContain("Not Found");
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

  test("applies custom class and styles", () => {
    const empty = NEmpty({
      description: "Custom empty",
      class: ["custom-class"],
      style: {color: "red", fontSize: "16px"},
    });

    expect(empty.className).toBe("h100 custom-class");
    expect(empty.style.color).toBe("red");
    expect(empty.style.fontSize).toBe("16px");
    expect(empty.textContent).toBe("Custom empty");
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
