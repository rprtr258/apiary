import {describe, test, expect, mock} from "bun:test";
import {m, setDisplay, signal} from "./utils.ts";

describe("m (DOM builder)", () => {
  test("creates element with props and text children", () => {
    const el = m("div", {id: "test", class: "foo bar", style: {color: "red"}}, "Hello", " World");
    expect(el.tagName).toBe("DIV");
    expect(el.id).toBe("test");
    expect(el.className).toBe("foo bar");
    expect(el.style.color).toBe("red");
    expect(el.textContent).toBe("Hello World");
  });

  test("attaches event listener and handles click", () => {
    const clickMock = mock(() => {});
    const el = m("button", {onclick: clickMock}, "Click me");
    el.click();
    expect(clickMock).toHaveBeenCalledTimes(1);
  });

  test("throws error when innerHTML used with children", () => {
    expect(() => {
      m("div", {innerHTML: "<span>test</span>"}, "child");
    }).toThrow("Can't use innerHTML with children");
  });

  test("handles nested elements", () => {
    const parent = m("div", {}, m("span", {}, "nested"), "text");
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].tagName).toBe("SPAN");
    expect(parent.children[0].textContent).toBe("nested");
    expect(parent.childNodes.length).toBe(2);
    expect(parent.childNodes[0].nodeType).toBe(Node.ELEMENT_NODE);
    expect((parent.childNodes[0] as Element).tagName).toBe("SPAN");
    expect(parent.childNodes[0].textContent).toBe("nested");
    expect(parent.childNodes[1].textContent).toBe("text");
  });
});

describe("setDisplay", () => {
  test("toggles display none on and off", () => {
    const el = document.createElement("div");
    expect(el.style.display).toBe("");

    // Hide
    setDisplay(el, false);
    expect(el.style.display).toBe("none");

    // Show
    setDisplay(el, true);
    expect(el.style.display).toBe("");
  });

  test("preserves original display on multiple toggles", () => {
    const el = document.createElement("div");
    el.style.display = "flex";

    setDisplay(el, false); // hide
    expect(el.style.display).toBe("none");

    setDisplay(el, true); // show
    expect(el.style.display).toBe("flex");

    setDisplay(el, false); // hide again
    expect(el.style.display).toBe("none");

    setDisplay(el, true); // show again
    expect(el.style.display).toBe("flex");
  });
});

describe("signal", () => {
  test("returns initial value", () => {
    const sig = signal(42);
    expect(sig.value).toBe(42);
  });

  test("updates value and notifies subscribers", () => {
    const sig = signal(0);
    const callback = mock((v: number, old: number) => void [v, old]);

    sig.sub(callback, false);
    sig.update(v => v + 1);

    expect(sig.value).toBe(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0, false);
  });

  test("unsubscribes correctly", () => {
    const sig = signal(0);
    const callback = mock(() => {});

    const unsub = sig.sub(callback, false);
    unsub();
    sig.update(v => v + 1);

    expect(callback).toHaveBeenCalledTimes(0);
  });

  test("unsubscribe after trigger correctly", () => {
    const sig = signal(0);
    const callback = mock(() => {});

    const unsub = sig.sub(callback, false);
    sig.update(v => v + 1);
    unsub();
    sig.update(v => v + 1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0, false);
  });

  test("does not notify if value unchanged", () => {
    const sig = signal(42);
    const callback = mock(() => {});

    sig.sub(callback, false);
    sig.update(v => v); // same value

    expect(callback).toHaveBeenCalledTimes(0);
  });

  test("calls subscriber immediately when immediate is true", () => {
    const sig = signal(42);
    const callback = mock((v: number, old: number) => void [v, old]);

    sig.sub(callback, true);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(42, undefined, true);
  });
});
