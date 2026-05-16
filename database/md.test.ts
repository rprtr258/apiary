import {describe, test, expect} from "bun:test";
import {sendMD} from "./md.ts";

describe("sendMD", () => {
  test("renders basic markdown", async () => {
    const result = await sendMD({data: "# Hello\n\nWorld"});
    expect(result.data).toContain("<h1");
    expect(result.data).toContain("Hello");
    expect(result.data).toContain("World");
  });

  test("renders code blocks", async () => {
    const result = await sendMD({data: "```js\nconsole.log('hi')\n```"});
    expect(result.data).toContain("console");
    expect(result.data).toContain("hi");
  });

  test("sanitizes HTML to prevent XSS", async () => {
    const result = await sendMD({data: `Hello <script>alert("xss")</script>`});
    expect(result.data).not.toContain("<script>");
    expect(result.data).toContain("Hello");
  });

  test("strips event handlers", async () => {
    const result = await sendMD({data: `<img src=x onerror="alert(1)">`});
    expect(result.data).not.toContain("onerror");
  });

  test("renders empty string", async () => {
    const result = await sendMD({data: ""});
    expect(result.data).toBe("");
  });

  test("renders tables", async () => {
    const result = await sendMD({data: "| A | B |\n|---|---|\n| 1 | 2 |"});
    expect(result.data).toContain("<table");
    expect(result.data).toContain("1");
    expect(result.data).toContain("2");
  });
});
