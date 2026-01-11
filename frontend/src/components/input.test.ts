import {describe, test, expect, mock} from "bun:test";
import {NInput} from "./input.ts";

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

    // Simulate user input
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
