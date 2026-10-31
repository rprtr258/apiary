import {describe, test, expect, mock} from "bun:test";
import NButton from "./button.ts";

describe("NButton", () => {
  test("size prop sets button size variables", () => {
    const button = NButton({size: 4, on: {click: () => {}}}).el;
    expect(button.style.getPropertyValue("--button-height")).toBe("var(--button-height-4)");
    expect(button.style.getPropertyValue("--button-padding-x")).toBe("var(--button-padding-x-4)");
    expect(button.style.getPropertyValue("--button-fz")).toBe("var(--font-size-4)");
  });

  test("no size prop sets no variables (sm default applies via CSS)", () => {
    const button = NButton({on: {click: () => {}}}).el;
    expect(button.style.getPropertyValue("--button-height")).toBe("");
  });

  test("renders button with children", () => {
    const clickMock = mock(() => {});
    const button = NButton({
      on: {click: clickMock},
    }, "Click me", "!").el;

    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("⏳Click me!");
  });

  test("calls click callback on click", () => {
    const clickMock = mock(() => {});
    const button = NButton({
      on: {click: clickMock},
    }, "Test").el;

    button.click();
    expect(clickMock).toHaveBeenCalledTimes(1);
  });

  test("applies custom styles and classes", () => {
    const clickMock = mock(() => {});
    const button = NButton({
      on: {click: clickMock},
      style: {width: "100px", backgroundColor: "red"},
      class: "test-button primary",
    }, "Styled").el;

    expect(button.classList).toContainValues(["test-button", "primary"]);
    expect(button.style.width).toBe("100px");
    expect(button.style.backgroundColor).toBe("red");
  });

  test("handles disabled state", () => {
    const clickMock = mock(() => {});
    const button = NButton({
      on: {click: clickMock},
      disabled: true,
    }, "Disabled").el;

    expect(button.disabled).toBe(true);

    button.click();
    expect(clickMock).toHaveBeenCalledTimes(0);
  });

  test("handles primary type", () => {
    const clickMock = mock(() => {});
    const button = NButton({
      on: {click: clickMock},
      primary: true,
    }, "Primary").el;

    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("⏳Primary");
  });
});
