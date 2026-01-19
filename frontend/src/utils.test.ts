import {describe, test, expect, mock} from "bun:test";
import {m, setDisplay, signal, deepEquals} from "./utils.ts";

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

  describe("callback pattern", () => {
    test("updates value and notifies subscribers", () => {
      const sig = signal(0);
      const callback = mock((v: number) => void v);

      const unsubscribe = sig.subCallback(callback);
      sig.update(v => v + 1);

      expect(sig.value).toBe(1);
      expect(callback).toHaveBeenCalledTimes(2); // Once for initial, once for update
      expect(callback).toHaveBeenCalledWith(0); // Initial call
      expect(callback).toHaveBeenCalledWith(1); // Update call

      unsubscribe();
    });

    test("unsubscribes correctly", () => {
      const sig = signal(0);
      const callback = mock(() => {});

      const unsub = sig.subCallback(callback);
      unsub();
      sig.update(v => v + 1);

      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });

    test("unsubscribe after trigger correctly", () => {
      const sig = signal(0);
      const callback = mock(() => {});

      const unsub = sig.subCallback(callback);
      sig.update(v => v + 1);
      unsub();
      sig.update(v => v + 1);

      expect(callback).toHaveBeenCalledTimes(2); // Initial + first update
    });

    test("does not notify if value unchanged", () => {
      const sig = signal(42);
      const callback = mock(() => {});

      sig.subCallback(callback);
      sig.update(v => v); // same value

      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });

    test("calls subscriber immediately on subscription", () => {
      const sig = signal(42);
      const callback = mock((v: number) => void v);

      sig.subCallback(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(42);
    });

    test("supports direct value assignment", () => {
      const sig = signal(0);
      const callback = mock((v: number) => void v);

      sig.subCallback(callback);
      sig.value = 10;

      expect(sig.value).toBe(10);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(10);
    });

    test("multiple subscribers work independently", () => {
      const sig = signal(0);
      const callback1 = mock(() => {});
      const callback2 = mock(() => {});

      const unsub1 = sig.subCallback(callback1);
      sig.subCallback(callback2); // No need to store unsubscribe since we won't use it

      sig.update(v => v + 1);

      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);

      unsub1();
      sig.update(v => v + 1);

      expect(callback1).toHaveBeenCalledTimes(2); // No more calls
      expect(callback2).toHaveBeenCalledTimes(3); // Still receiving updates
    });
  });

  describe("generator pattern (backward compatibility)", () => {
    test("works with generator subscribers", () => {
      const sig = signal(0);
      const callback = mock((v: number, old: number) => void [v, old]);

      sig.sub(function*(): Generator<undefined, never, number> {
        let old: number = yield;
        while (true) {
          const v = yield;
          callback(v, old);
          old = v;
        }
      }());
      sig.update(v => v + 1);

      expect(sig.value).toBe(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1, 0);
    });

    test("unsubscribes generator correctly", () => {
      const sig = signal(0);
      const callback = mock(() => {});

      const unsub = sig.sub(function*(): Generator<undefined, never, number> {
        yield;
        while (true) {
          yield;
          callback();
        }
      }());
      unsub();
      sig.update(v => v + 1);

      expect(callback).toHaveBeenCalledTimes(0);
    });
  });
});

describe("deepEquals", () => {
  const obj1 = {a: {b: {c: [1, 2, {d: "test"}]}}};
  const obj2 = {a: {b: {c: [1, 2, {d: "test"}]}}};
  const obj3 = {a: {b: {c: [1, 2, {d: "different"}]}}};

  const date1 = new Date("2023-01-01T00:00:00.000Z");
  const date2 = new Date("2023-01-01T00:00:00.000Z");
  const date3 = new Date("2023-01-02T00:00:00.000Z");

  const regex1 = /test/gi;
  const regex2 = /test/gi;
  const regex3 = /test/g;
  const regex4 = /different/gi;

  class Custom1 { x = 1; }
  class Custom2 { x = 1; }

  const sym = Symbol("test");

  const positiveTests: [unknown, unknown][] = [
    [42, 42],
    ["hello", "hello"],
    [true, true],
    [null, null],
    [undefined, undefined],
    [NaN, NaN],
    [{a: 1, b: 2}, {a: 1, b: 2}],
    [{a: 1, b: 2}, {b: 2, a: 1}],
    [[1, 2, 3], [1, 2, 3]],
    [[], []],
    [obj1, obj2],
    [{}, {}],
    [date1, date2],
    [regex1, regex2],
    [new Custom1(), new Custom1()],
    [{[sym]: "value"}, {[sym]: "different"}], // symbol ignored
  ];
  test("positive tests", () => {
    for (const [a, b] of positiveTests) {
      expect(deepEquals(a, b)).toBe(true);
    }
  });

  const negativeTests: [unknown, unknown][] = [
    [42, 43],
    ["hello", "world"],
    [true, false],
    [null, undefined],
    [0, false],
    [NaN, 42],
    [42, NaN],
    [{a: 1, b: 2}, {a: 1, b: 3}],
    [{a: 1, b: 2}, {a: 1}],
    [[1, 2, 3], [1, 2]],
    [[1, 2, 3], [1, 2, 4]],
    [obj1, obj3],
    [{}, []],
    [date1, date3],
    [regex1, regex3], // different flags
    [regex1, regex4], // different pattern
    [new Custom1(), new Custom2()],
  ];
  test("negative tests", () => {
    for (const [a, b] of negativeTests) {
      expect(deepEquals(a, b)).toBe(false);
    }
  });
});
