import {describe, test, expect, mock} from "bun:test";
import {NInput, NInputGroup} from "./input.ts";

describe("input sizing", () => {
  test("size prop sets size variables", () => {
    const input = NInput({size: 4, on: {update: () => {}}});
    expect(input.style.getPropertyValue("--input-height")).toBe("var(--input-height-4)");
    expect(input.style.getPropertyValue("--input-fz")).toBe("var(--font-size-4)");
  });

  test("no size prop sets no variables (sm default applies via CSS)", () => {
    const input = NInput({on: {update: () => {}}});
    expect(input.style.getPropertyValue("--input-height")).toBe("");
  });

  test("caller style overrides size variables", () => {
    const input = NInput({size: 4, style: {"--input-height": "20px"} as Partial<CSSStyleDeclaration>, on: {update: () => {}}});
    expect(input.style.getPropertyValue("--input-height")).toBe("20px");
  });
});

describe("NInput", () => {
  test("renders with given props", () => {
    const input = NInput({
      placeholder: "Enter text",
      value: "test value",
      style: {width: "100%", padding: "0.5em"},
    });

    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("placeholder")).toBe("Enter text");
    expect(input.getAttribute("value")).toBe("test value");
    expect(input.style.width).toBe("100%");
    expect(input.style.padding).toBe("0.5em");
  });

  test("calls update callback on input event", () => {
    const updateMock = mock((s: string) => void s);
    const input = NInput({
      on: {update: updateMock},
      value: "initial",
    });

    input.value = "new value";
    input.dispatchEvent(new Event("input", {bubbles: true}));

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith("new value");
  });

  test("handles missing optional props", () => {
    const input = NInput({});
    expect(input.tagName).toBe("INPUT");
    expect(input.placeholder).toBe("");
    expect(input.value).toBe("");
  });
});

describe("NInputGroup", () => {
  test("creates div with children", () => {
    const input1 = NInput({placeholder: "Input 1"});
    const input2 = NInput({placeholder: "Input 2"});

    const group = NInputGroup(
      {style: {display: "flex", gap: "10px"}},
      input1,
      input2,
    );

    expect(group.tagName).toBe("DIV");
    expect(group.style.display).toBe("flex");
    expect(group.style.gap).toBe("10px");
    expect(group.children.length).toBe(2);
    expect(group.children[0]).toBe(input1);
    expect(group.children[1]).toBe(input2);
  });

  test("creates empty group", () => {
    const group = NInputGroup({style: {}});
    expect(group.tagName).toBe("DIV");
    expect(group.children.length).toBe(0);
  });
});
