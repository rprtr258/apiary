import {describe, test, expect} from "bun:test";
import ViewJSON from "./ViewJSON.ts";

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (check())
      return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("condition not met");
}

describe("ViewJSON", () => {
  test("shows jq errors in the tooltip and clears them on fix", async () => {
    const view = ViewJSON("{}");
    document.body.append(view.el);
    try {
      const el_input = view.el.querySelector("input") as HTMLInputElement;
      const el_tooltip = (view.el.children[1] as HTMLElement).children[1] as HTMLElement;
      expect(el_tooltip.style.display).toBe("none");

      el_input.value = "badfilter";
      el_input.dispatchEvent(new Event("input", {bubbles: true}));
      await waitFor(() => el_tooltip.style.display === "block");
      expect(el_tooltip.textContent).toContain("error");

      el_input.value = ".";
      el_input.dispatchEvent(new Event("input", {bubbles: true}));
      await waitFor(() => el_tooltip.style.display === "none");
      expect(el_tooltip.textContent).toBe("");
    } finally {
      view.unmount();
      view.el.remove();
    }
  });
});
