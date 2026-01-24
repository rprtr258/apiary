import {describe, test, expect, mock} from "bun:test";
import {NInput, NSelect, NButton, NInputGroup} from "./input.ts";

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

describe("NSelect", () => {
  test("renders select with options", () => {
    const updateMock = mock((v: string) => void v);
    const {el} = NSelect({
      placeholder: "Select an option",
      options: [
        {label: "Option 1", value: "value1"},
        {label: "Option 2", value: "value2"},
        {label: "Option 3", value: "value3"},
      ],
      on: {update: updateMock},
    });

    expect(el.tagName).toBe("SELECT");
    expect(el.children.length).toBe(4); // placeholder + 3 options

    const options = el.children;
    expect(options[0].tagName).toBe("OPTION");
    expect(options[0].getAttribute("value")).toBe("");
    expect(options[0].hasAttribute("disabled")).toBe(false); // Not disabled when placeholder provided
    expect(options[0].hasAttribute("hidden")).toBe(true);

    expect(options[1].tagName).toBe("OPTION");
    expect(options[1].getAttribute("value")).toBe("0");
    expect(options[1].textContent).toBe("Option 1");

    expect(options[2].tagName).toBe("OPTION");
    expect(options[2].getAttribute("value")).toBe("1");
    expect(options[2].textContent).toBe("Option 2");

    expect(options[3].tagName).toBe("OPTION");
    expect(options[3].getAttribute("value")).toBe("2");
    expect(options[3].textContent).toBe("Option 3");
  });

  test("selects option by label", () => {
    const updateMock = mock((v: string) => void v);
    const {el} = NSelect({
      label: "Option 2",
      placeholder: "Select",
      options: [
        {label: "Option 1", value: "value1"},
        {label: "Option 2", value: "value2"},
        {label: "Option 3", value: "value3"},
      ],
      on: {update: updateMock},
    });

    const options = Array.from(el.children) as HTMLOptionElement[];
    expect(options[1].selected).toBe(false); // Option 1 not selected
    expect(options[2].selected).toBe(true); // Option 2 selected
    expect(options[3].selected).toBe(false); // Option 3 not selected
  });

  test("uses placeholder when label not found", () => {
    const updateMock = mock((v: string) => void v);
    const {el} = NSelect({
      label: "Non-existent",
      placeholder: "Select an option",
      options: [
        {label: "Option 1", value: "value1"},
        {label: "Option 2", value: "value2"},
      ],
      on: {update: updateMock},
    });

    const options = Array.from(el.children) as HTMLOptionElement[];
    expect(options[0].selected).toBe(true); // Placeholder selected
    expect(options[0].textContent).toBe("Select an option");
    expect(options[1].selected).toBe(false);
    expect(options[2].selected).toBe(false);
  });

  test("throws error when label not found and no placeholder", () => {
    const updateMock = mock((v: string) => void v);

    expect(() => {
      NSelect({
        label: "Non-existent",
        options: [
          {label: "Option 1", value: "value1"},
        ],
        on: {update: updateMock},
      });
    }).toThrow("Option Non-existent not found");
  });

  test("calls update callback on change", () => {
    const updateMock = mock((v: string) => void v);
    const {el} = NSelect({
      placeholder: "Select",
      options: [
        {label: "Option 1", value: "value1"},
        {label: "Option 2", value: "value2"},
      ],
      on: {update: updateMock},
    });

    // Simulate selecting option 2
    (el as HTMLSelectElement).value = "1";
    el.dispatchEvent(new Event("change", {bubbles: true}));

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith("value2");
  });

  test("reset method clears selection", () => {
    const updateMock = mock((v: string) => void v);
    const select = NSelect({
      label: "Option 2",
      placeholder: "Select",
      options: [
        {label: "Option 1", value: "value1"},
        {label: "Option 2", value: "value2"},
      ],
      on: {update: updateMock},
    });

    const options = Array.from(select.el.children) as HTMLOptionElement[];
    expect(options[0].selected).toBe(false); // Placeholder not selected
    expect(options[2].selected).toBe(true); // Option 2 selected

    select.reset();

    expect(options[0].selected).toBe(true); // Placeholder now selected
    expect(options[2].selected).toBe(false); // Option 2 no longer selected
  });

  test("applies custom styles", () => {
    const updateMock = mock((v: string) => void v);
    const {el} = NSelect({
      placeholder: "Select",
      options: [{label: "Option", value: "value"}],
      style: {width: "200px", fontSize: "14px"},
      on: {update: updateMock},
    });

    expect(el.style.width).toBe("200px");
    expect(el.style.fontSize).toBe("14px");
  });

  test("handles disabled option with undefined value", () => {
    const updateMock = mock((v: string) => void v);
    const {el} = NSelect({
      placeholder: "Select",
      options: [
        {label: "Disabled option", value: undefined},
        {label: "Enabled option", value: "value"},
      ],
      on: {update: updateMock},
    });

    const options = Array.from(el.children);
    expect(options[1].hasAttribute("disabled")).toBe(true); // Disabled option
    expect(options[2].hasAttribute("disabled")).toBe(false); // Enabled option
  });
});

describe("NButton", () => {
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

    // Click should not call callback when disabled
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
