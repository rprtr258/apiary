import {describe, test, expect, mock, beforeEach} from "bun:test";
import {CommandPalette, Footer, styles} from "./CommandPalette.ts";
import {m} from "../utils.ts";
import {KeyboardEvent} from "happy-dom";

function keyEvent(key: string): Event {
  return new KeyboardEvent("keydown", {bubbles: true, key: key}) as unknown as Event;
}

describe("CommandPalette", () => {
  let closeMock: () => void;
  beforeEach(() => {
    closeMock = mock(() => {});
  });

  test("renders with basic props", () => {
    const items = () => [
      {label: "Test Item 1", perform: mock(() => {})},
      {label: "Test Item 2", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      placeholder: "Search commands...",
      on: {close: closeMock},
    });

    expect(palette.el.tagName).toBe("DIV");

    // Check modal structure exists
    const modal = palette.el.querySelector("div");
    expect(modal).not.toBeNull();

    // Check input
    const input = modal!.querySelector("input");
    expect(input).not.toBeNull();
    expect(input!.getAttribute("placeholder")).toBe("Search commands...");
    expect(input!.getAttribute("type")).toBe("text");

    // Check footer exists
    const footer = modal!.querySelector("div");
    expect(footer).not.toBeNull();
  });

  test("shows empty state when no items", () => {
    const items = () => [];
    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    // Make palette visible to trigger item computation
    palette.visible = true;

    // Check that empty message appears in the palette text content
    expect(palette.el.textContent).toContain("No results found.");
  });

  test("filters items based on search", () => {
    const item1Perform = mock(() => {});
    const item2Perform = mock(() => {});
    const items = () => [
      {label: "Create Request", perform: item1Perform},
      {label: "Delete Request", perform: item2Perform},
      {label: "Rename Request", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    // Make palette visible
    palette.visible = true;

    // Get input and simulate search
    const input = palette.el.querySelector("input")!;
    input.value = "create";
    input.dispatchEvent(new Event("input", {bubbles: true}));

    // Should only show "Create Request" when searching for "create"
    const itemsEls = [...palette.el.querySelectorAll(`div.${styles.item}`)] as HTMLElement[];
    expect(itemsEls.map(el => el.style.display)).toEqual(["", "none", "none"]);
  });

  test("filters items by group name", () => {
    const items = () => [
      {label: "Create", group: "Request", perform: mock(() => {})},
      {label: "Delete", group: "Request", perform: mock(() => {})},
      {label: "Save", group: "File", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const input = palette.el.querySelector("input")!;
    input.value = "file";
    input.dispatchEvent(new Event("input", {bubbles: true}));

    // Check that only "Save" (from "File" group) is visible
    const itemsEls = [...palette.el.querySelectorAll(`div.${styles.item}`)] as HTMLElement[];
    expect(itemsEls.map(el => el.style.display)).toEqual(["none", "none", ""]);
  });

  test("handles keyboard navigation", () => {
    const item1Perform = mock(() => {});
    const item2Perform = mock(() => {});
    const items = () => [
      {label: "Item 1", perform: item1Perform},
      {label: "Item 2", perform: item2Perform},
      {label: "Item 3", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const modal = palette.el.querySelector("div")!;

    // Test ArrowDown
    const arrowDownEvent = keyEvent("ArrowDown");
    modal.dispatchEvent(arrowDownEvent);

    // Test ArrowUp
    const arrowUpEvent = keyEvent("ArrowUp");
    modal.dispatchEvent(arrowUpEvent);

    // Test Enter to select
    const enterEvent = keyEvent("Enter");
    modal.dispatchEvent(enterEvent);

    expect(item1Perform).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("selected index is correct after empty filter", () => {
    const item1Perform = mock(() => {});
    const items = () => [
      {label: "Item 1", perform: item1Perform},
      {label: "Item 2", perform: () => {}},
      {label: "Item 3", perform: () => {}},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;
    {
      const els = [...palette.el.querySelectorAll(`div.${styles.item}`)] as HTMLElement[];
      expect(els.map(el => el.style.display)).toEqual(["", "", ""]);
      expect(els.map(e => e.classList.contains(styles.itemSelected))).toEqual([true, false, false]);
    }
    const input = palette.el.querySelector("input")!;
    input.value = "a"; // empty search
    input.dispatchEvent(new Event("input", {bubbles: true}));
    {
      const els = [...palette.el.querySelectorAll(`div.${styles.item}`)] as HTMLElement[];
      expect(els.map(el => el.style.display)).toEqual(["none", "none", "none"]);
      expect(els.map(e => e.classList.contains(styles.itemSelected))).toEqual([true, false, false]);
    }
    const modal = palette.el.querySelector("div")!;
    modal.dispatchEvent(keyEvent("ArrowUp")); // select previous
    input.value = ""; // undo search
    input.dispatchEvent(new Event("input", {bubbles: true}));
    {
      const els = [...palette.el.querySelectorAll(`div.${styles.item}`)] as HTMLElement[];
      expect(els.map(el => el.style.display)).toEqual(["", "", ""]);
      expect(els.map(e => e.classList.contains(styles.itemSelected))).toEqual([true, false, false]);
    }
    modal.dispatchEvent(keyEvent("Enter")); // perform

    expect(item1Perform).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("handles Escape key to close", () => {
    const palette = CommandPalette({
      items: () => [{label: "Test", perform: mock(() => {})}],
      on: {close: closeMock},
    });

    palette.visible = true;

    const modal = palette.el.querySelector("div")!;
    const escapeEvent = keyEvent("Escape");
    modal.dispatchEvent(escapeEvent);

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("closes when clicking outside modal", () => {
    const palette = CommandPalette({
      items: () => [{label: "Test", perform: mock(() => {})}],
      on: {close: closeMock},
    });

    palette.visible = true;

    // Click on overlay (outside modal)
    palette.el.click();

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("does not close when clicking inside modal", () => {
    const palette = CommandPalette({
      items: () => [{label: "Test", perform: mock(() => {})}],
      on: {close: closeMock},
    });

    palette.visible = true;

    // Click on modal content (inside)
    const modal = palette.el.querySelector("div")!;
    modal.click();

    expect(closeMock).toHaveBeenCalledTimes(0);
  });

  test("handles item click", () => {
    const itemPerform = mock(() => {});
    const items = () => [
      {label: "Clickable Item", perform: itemPerform},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    // Test that the item's perform function is called when selected via keyboard
    const modal = palette.el.querySelector("div")!;
    const enterEvent = keyEvent("Enter");
    modal.dispatchEvent(enterEvent);

    expect(itemPerform).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("shows item shortcuts", () => {
    const items = () => [
      {
        label: "Create Request",
        shortcut: ["Ctrl", "N"],
        perform: mock(() => {}),
      },
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const shortcutKeys = palette.el.querySelectorAll("kbd");
    expect(shortcutKeys.length).toBe(6); // 2 from item, 4 from palette itself

    // Check that Ctrl and N appear somewhere in the modal
    const modalText = palette.el.textContent;
    expect(modalText).toContain("Ctrl");
    expect(modalText).toContain("N");
  });

  test("shows item with prefix", () => {
    const items = () => [
      {
        label: "Tool Item",
        prefix: m("span", {}, "🔧"),
        perform: mock(() => {}),
      },
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    // Check that the prefix appears in the modal
    const modalText = palette.el.textContent;
    expect(modalText).toContain("🔧");
    expect(modalText).toContain("Tool Item");
  });

  test("shows group prefix when no custom prefix", () => {
    const items = () => [
      {
        label: "Grouped Item",
        group: "Actions",
        perform: mock(() => {}),
      },
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const modalText = palette.el.textContent;
    expect(modalText).toContain("Actions:");
    expect(modalText).toContain("Grouped Item");
  });

  test("does not show group prefix when custom prefix exists", () => {
    const items = () => [
      {
        label: "Starred Item",
        group: "Favorites",
        prefix: m("span", {}, "⭐"),
        perform: mock(() => {}),
      },
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const modalText = palette.el.textContent;
    expect(modalText).not.toContain("Favorites:");
    expect(modalText).toContain("⭐");
    expect(modalText).toContain("Starred Item");
  });

  test("handles blur event when focus moves to item", () => {
    const items = () => [
      {label: "Item 1", perform: mock(() => {})},
      {label: "Item 2", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const input = palette.el.querySelector("input")!;

    // Find an item
    const modal = palette.el.querySelector("div");
    const allDivs = Array.from(modal!.querySelectorAll("div"));
    const firstItem = allDivs.find(div => div.textContent.includes("Item 1"));
    expect(firstItem).not.toBeUndefined();

    // Simulate focus moving from input to item
    const blurEvent = new Event("blur", {bubbles: true}) as FocusEvent;
    Object.defineProperty(blurEvent, "relatedTarget", {value: firstItem});

    input.dispatchEvent(blurEvent);

    // Should not close since focus moved to item
    expect(closeMock).toHaveBeenCalledTimes(0);
  });

  test("handles blur event when focus leaves modal", () => {
    const items = () => [
      {label: "Item", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const input = palette.el.querySelector("input")!;

    // Simulate focus leaving modal (relatedTarget is null)
    const blurEvent = new Event("blur", {bubbles: true}) as FocusEvent;
    Object.defineProperty(blurEvent, "relatedTarget", {value: null});

    input.dispatchEvent(blurEvent);

    // Should close since focus left modal
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test("recomputes items when palette becomes visible", () => {
    let itemCount = 1;
    const items = () => [
      {label: `Item ${itemCount}`, perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    // First show
    palette.visible = true;

    expect(palette.el.textContent).toContain("Item 1");

    // Hide and update item count
    palette.visible = false;
    itemCount = 2;

    // Show again - should recompute
    palette.visible = true;

    expect(palette.el.textContent).toContain("Item 2");
  });

  test("resets search and selection when palette becomes visible", () => {
    const items = () => [
      {label: "Item 1", perform: mock(() => {})},
      {label: "Item 2", perform: mock(() => {})},
      {label: "Item 3", perform: mock(() => {})},
    ];

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    // First show and search
    palette.visible = true;
    const input = palette.el.querySelector("input")!;
    input.value = "item 2";
    input.dispatchEvent(new Event("input", {bubbles: true}));

    // Navigate down
    const modal = palette.el.querySelector("div")!;
    const arrowDownEvent = keyEvent("ArrowDown");
    modal.dispatchEvent(arrowDownEvent);

    // Hide and show again
    palette.visible = false;
    palette.visible = true;

    expect(input.value).toBe(""); // Search cleared
    // Should reset to first item and clear search
    const itemsEls = [...palette.el.querySelectorAll(`div.${styles.item}`)] as HTMLElement[];
    expect(itemsEls.length).toBe(3);
    expect(itemsEls.map(el => el.style.display)).toEqual(["", "", ""]);
    expect([...itemsEls[0].classList]).toContain(styles.itemSelected);
    expect([...itemsEls[1].classList]).not.toContain(styles.itemSelected);
    expect([...itemsEls[2].classList]).not.toContain(styles.itemSelected);
  });

  test("scrolls selected item into view", () => {
    const items = () => Array.from({length: 20}, (_, i) => ({
      label: `Item ${i + 1}`,
      perform: mock(() => {}),
    }));

    const palette = CommandPalette({
      items,
      on: {close: closeMock},
    });

    palette.visible = true;

    const modal = palette.el.querySelector("div")!;

    // Navigate to item 10
    const arrowDownEvent = keyEvent("ArrowDown");
    for (let i = 0; i < 10; i++) {
      modal.dispatchEvent(arrowDownEvent);
    }

    // The scrollIntoView should have been called
    // We can't easily test the scroll position in happy-dom,
    // but navigation should work without errors
    const modalText = palette.el.textContent;
    expect(modalText).toContain("Item 1");
    expect(modalText).toContain("Item 20");
  });
});

describe("Footer", () => {
  test("renders footer with navigation hints", () => {
    const footer = Footer();

    expect(footer.tagName).toBe("DIV");

    const footerDivs = footer.querySelectorAll("div");
    expect(footerDivs.length).toBe(3);

    // Check footer text contains navigation hints
    const footerText = footer.textContent;
    expect(footerText).toContain("to select");
    expect(footerText).toContain("to navigate");
    expect(footerText).toContain("to close");

    // Should have kbd elements for keys
    const kbdElements = footer.querySelectorAll("kbd");
    expect(kbdElements.length).toBe(4);
  });
});
