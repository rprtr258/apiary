import {describe, test, expect, beforeEach} from "bun:test";
import {css} from "./styles.ts";

function rules(): string {
  return document.querySelector("#dynamic-styles")?.textContent ?? "";
}

beforeEach(() => {
  const el = document.querySelector("#dynamic-styles");
  if (el !== null)
    el.textContent = "";
});

describe("css", () => {
  test("string form generates class with declarations", () => {
    const id = css("border-color: red;");
    expect(id).not.toBe("");
    expect(rules()).toEqual(`.${id} { border-color: red; }\n`);
  });

  test("returns unique class per call", () => {
    const a = css("color: red;");
    const b = css("color: blue;");
    expect(a).not.toBe(b);
  });

  test("object form converts camelCase keys to kebab-case declarations", () => {
    const id = css({color: "red", fontSize: "12px", zIndex: "5"});
    expect(rules()).toEqual(`.${id} { color: red; font-size: 12px; z-index: 5 }\n`);
  });

  test("object form skips undefined values", () => {
    const id = css({display: undefined, opacity: "0.5"});
    expect(rules()).toEqual(`.${id} { opacity: 0.5 }\n`);
  });
});

describe("css.raw", () => {
  test("appends selector block without wrapping braces", () => {
    const id = css.raw(":hover {background-color: blue;}");
    expect(rules()).toEqual(`.${id}:hover {background-color: blue;}\n`);
  });
});
