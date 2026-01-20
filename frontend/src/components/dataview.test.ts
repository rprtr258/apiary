import {describe, test, expect} from "bun:test";
import {NTag, NResult, NEmpty, NList, NListItem, Json} from "./dataview.ts";
import {m} from "../utils.ts";

describe("Json component", () => {
  test("renders JSON data as formatted string", () => {
    const data = {name: "test", value: 42, nested: {foo: "bar"}};
    const component = Json({data});

    expect(component.tagName).toBe("PRE");
    expect(component.textContent).toBe(JSON.stringify(data, null, 2));
  });

  test("handles primitive values", () => {
    const stringComponent = Json({data: "test string"});
    expect(stringComponent.textContent).toBe(JSON.stringify("test string", null, 2));

    const numberComponent = Json({data: 123});
    expect(numberComponent.textContent).toBe(JSON.stringify(123, null, 2));

    const booleanComponent = Json({data: true});
    expect(booleanComponent.textContent).toBe(JSON.stringify(true, null, 2));

    const nullComponent = Json({data: null});
    expect(nullComponent.textContent).toBe(JSON.stringify(null, null, 2));
  });
});

describe("NTag component", () => {
  test("renders tag with correct type color", () => {
    const successTag = NTag({type: "success"}, "Success");
    expect(successTag.tagName).toBe("SPAN");
    expect(successTag.textContent).toBe("Success");
    expect(successTag.style.color).toBe("lime");

    const errorTag = NTag({type: "error"}, "Error");
    expect(errorTag.style.color).toBe("red");

    const warningTag = NTag({type: "warning"}, "Warning");
    expect(warningTag.style.color).toBe("yellow");

    const infoTag = NTag({type: "info"}, "Info");
    expect(infoTag.style.color).toBe("blue");
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
    expect(list.children.length).toBe(3);

    const items = Array.from(list.children);
    expect(items[0].tagName).toBe("LI");
    expect(items[0].className).toBe("item1");
    expect(items[0].textContent).toBe("Item 1");

    expect(items[1].tagName).toBe("LI");
    expect(items[1].className).toBe("item2");
    expect(items[1].textContent).toBe("Item 2");

    expect(items[2].tagName).toBe("LI");
    expect(items[2].className).toBe("item3");
    expect(items[2].textContent).toBe("Item 3");
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