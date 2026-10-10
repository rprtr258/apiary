import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, test} from "bun:test";
import {ESLint, Linter} from "eslint";
import tseslint from "typescript-eslint";
import {noBooleanLiteralCompare} from "./no-boolean-literal-compare.ts";

type LintMessage = Linter.LintMessage;

// Opt out of typescript-eslint's single-run mode: with CI=true (GitHub Actions)
// inferSingleRun() caches one AOT program per tsconfig module-globally, so fixture
// files written after the first lint would never be added to it (the linter reports
// them as not part of the project). The watch-program path used otherwise
// invalidates programs when new files appear, which this test relies on.
process.env.TSESTREE_SINGLE_RUN = "false";

// Type-aware linting needs a real TS program, so the fixtures share one temp
// dir with a minimal strict tsconfig (the default project ignores
// strictNullChecks, which would collapse `boolean | undefined` to `boolean`).
// The dir and ESLint instance are created once: type-aware linting builds a
// TS type-checker per program, and rebuilding it per call dominates runtime.
// Each fixture gets a UNIQUE filename (fixture-1.ts, fixture-2.ts, ...) so the
// cached program picks up new files instead of serving stale per-file results.
let dir: string;
let eslint: ESLint;
beforeAll(() => {
  // Sync fs: test-suite-wide mock.module("fs/promises") in main/*.test.ts would
  // intercept the fixture writes, so async fs is off-limits here.
  dir = mkdtempSync(join(tmpdir(), "no-boolean-literal-compare-"));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({compilerOptions: {strict: true, noEmit: true, skipLibCheck: true}, include: ["*.ts"]}));
  eslint = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: {
      files: ["**/*.ts"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {project: join(dir, "tsconfig.json"), tsconfigRootDir: dir},
      },
      plugins: {local: {rules: {"no-boolean-literal-compare": noBooleanLiteralCompare}}},
      rules: {"local/no-boolean-literal-compare": "error"},
    },
  });
});
afterAll(() => {
  rmSync(dir, {recursive: true, force: true});
});

let fixtureCounter = 0;
async function lint(code: string): Promise<LintMessage[]> {
  fixtureCounter += 1;
  const fixtureName = `fixture-${fixtureCounter}.ts`;
  writeFileSync(join(dir, fixtureName), code);
  const results = await eslint.lintFiles([fixtureName]);
  return results[0].messages.filter(message => message.ruleId === "local/no-boolean-literal-compare");
}

describe("local/no-boolean-literal-compare", () => {
  test("flags exact-boolean comparisons in every orientation with the computed replacement", async () => {
    const messages = await lint(`
      let x = false;
      const a = x === true;
      const b = x !== false;
      const c = x === false;
      const d = x !== true;
      const e = true === x;
      const f = true !== x;
      const g = false === x;
      const h = false !== x;
    `);
    expect(messages).toHaveLength(8);
    expect(messages.map(hit => hit.suggestions?.[0]?.fix.text)).toEqual([
      "x", "x", "!x", "!x", "x", "!x", "!x", "x",
    ]);
    expect(messages[0].message).toBe("Do not compare against a boolean literal: replace `x === true` with `x`. Explicit comparison is only for narrowing union values.");
  });

  test("suggests parentheses around operands that would change precedence under `!`", async () => {
    const messages = await lint(`
      const a = 1;
      const b = 2;
      const flag = (a > b) === false;
    `);
    expect(messages[0]?.suggestions?.[0]?.fix.text).toBe("!(a > b)");
  });

  test("treats unions of only boolean literals as exact booleans", async () => {
    const messages = await lint(`
      function f(v: true | false): boolean {
        return v === true;
      }
    `);
    expect(messages).toHaveLength(1);
  });

  test("passes plain truthiness, union narrowing, and non-boolean literals", async () => {
    const messages = await lint(`
      let x = false;
      if (x) {}
      if (!x) {}
      const n = 1;
      const s = "a";
      const num = n === 1;
      const str = s === "a";
      function f(v: string | boolean | null): boolean {
        if (v === null) return true;
        return v === false;
      }
      function g(v: boolean | undefined): boolean {
        return v === true;
      }
    `);
    expect(messages).toEqual([]);
  });
});
