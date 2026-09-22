import {describe, test, expect, mock} from "bun:test";
import {MouseEvent, KeyboardEvent} from "happy-dom";
import {NInput, NSelect, NButton, NInputGroup, NSelectInput} from "./input.ts";

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

describe("NSelectInput", () => {
  const options = () => [
    {label: "prod/mydb", value: "id1"},
    {label: "prod/other", value: "id2"},
  ];

  const popup = (el: HTMLDivElement): HTMLDivElement =>
    el.querySelector("div[role='listbox']") as HTMLDivElement;
  const keydown = (key: string): Event =>
    new KeyboardEvent("keydown", {bubbles: true, key: key}) as unknown as Event;
  const mousedown = (): Event =>
    new MouseEvent("mousedown", {bubbles: true, cancelable: true}) as unknown as Event;

  test("renders input with options in popup after focus", () => {
    const el = NSelectInput({placeholder: "DSN", options});

    expect(el.tagName).toBe("DIV");
    const input = el.querySelector("input") as HTMLInputElement;
    const el_popup = popup(el);
    expect(input.getAttribute("placeholder")).toBe("DSN");
    expect(el_popup.style.display).toBe("none"); // closed

    input.dispatchEvent(new Event("focus"));
    expect(el_popup.children.length).toBe(2);
    const [first, second] = [...el_popup.children] as HTMLDivElement[];
    expect(first.getAttribute("role")).toBe("option");
    expect(first.textContent).toBe("prod/mydb");
    expect(second.textContent).toBe("prod/other");
  });

  test("shows option label for known value", () => {
    const el = NSelectInput({options, value: "id1"});
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("value")).toBe("prod/mydb");
  });

  test("shows raw custom value", () => {
    const el = NSelectInput({options, value: "localhost:5432/db"});
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("value")).toBe("localhost:5432/db");
  });

  test("reports option value when entered text matches a label", () => {
    const updateMock = mock((s: string) => void s);
    const el = NSelectInput({options, on: {update: updateMock}});
    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "prod/other";
    input.dispatchEvent(new Event("input"));
    expect(updateMock).toHaveBeenCalledWith("id2");
  });

  test("reports raw text for custom input", () => {
    const updateMock = mock((s: string) => void s);
    const el = NSelectInput({options, on: {update: updateMock}});
    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "localhost:5432/db";
    input.dispatchEvent(new Event("input"));
    expect(updateMock).toHaveBeenCalledWith("localhost:5432/db");
  });

  test("re-evaluates options getter on focus", () => {
    let current = options();
    const el = NSelectInput({options: () => current});
    const el_popup = popup(el);
    const input = el.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));
    expect(el_popup.children.length).toBe(2);

    current = [{label: "dev/newdb", value: "id3"}];
    input.dispatchEvent(new Event("focus"));
    expect(el_popup.children.length).toBe(1);
    expect(el_popup.children[0].textContent).toBe("dev/newdb");
  });

  test("closes popup on blur", () => {
    const el = NSelectInput({options});
    const el_popup = popup(el);
    const input = el.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));
    expect(el_popup.children.length).toBe(2);
    input.dispatchEvent(new Event("blur"));
    expect(el_popup.style.display).toBe("none");
  });

  test("none option is disabled and non-choosable when no options exist", () => {
    const updateMock = mock((s: string) => void s);
    const el = NSelectInput({options: () => [], on: {update: updateMock}});
    const el_popup = popup(el);
    const input = el.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));
    expect(el_popup.children.length).toBe(1);
    const noneOpt = el_popup.children[0] as HTMLDivElement;
    expect(noneOpt.textContent).toBe("none");
    expect(noneOpt.getAttribute("aria-disabled")).toBe("true");

    noneOpt.dispatchEvent(mousedown());
    expect(input.value).toBe("");
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("none placeholder appears disabled only when filter matches no options", () => {
    const updateMock = mock((s: string) => void s);
    const el = NSelectInput({options, on: {update: updateMock}});
    const el_popup = popup(el);
    const input = el.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));
    expect(el_popup.children.length).toBe(2); // no none while options match

    input.value = "no-match";
    input.dispatchEvent(new Event("input"));
    expect(el_popup.children.length).toBe(1);
    const noneOpt = el_popup.children[0] as HTMLDivElement;
    expect(noneOpt.textContent).toBe("none");
    expect(noneOpt.getAttribute("aria-disabled")).toBe("true");

    noneOpt.dispatchEvent(mousedown());
    expect(input.value).toBe("no-match"); // untouched, still reported as raw text
    expect(updateMock).toHaveBeenCalledWith("no-match");
  });

  test("keyboard navigation cannot pick disabled none", () => {
    const updateMock = mock((s: string) => void s);
    const el = NSelectInput({options: () => [], on: {update: updateMock}});
    const input = el.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));
    const down = () => input.dispatchEvent(keydown("ArrowDown"));
    const enter = () => input.dispatchEvent(keydown("Enter"));

    down(); // highlight would land on disabled "none"
    enter();
    expect(input.value).toBe("");
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("keyboard navigation picks an option with Enter", () => {
    const updateMock = mock((s: string) => void s);
    const el = NSelectInput({options, on: {update: updateMock}});
    const input = el.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));
    input.dispatchEvent(keydown("Enter")); // first option is pre-highlighted
    expect(input.value).toBe("prod/mydb");
    expect(updateMock).toHaveBeenCalledWith("id1");
  });
});
